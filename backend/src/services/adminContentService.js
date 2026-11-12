const { pool } = require('../config/database');

const RESOURCE_CONFIG = {
  pages: {
    table: 'content_pages', id: 'page_id', fields: ['title', 'slug', 'content', 'status'],
    select: 'page_id AS id, title, slug, content, status, created_at, updated_at', search: '(title LIKE ? OR slug LIKE ? OR content LIKE ?)'
  },
  blog: {
    table: 'blog_posts', id: 'post_id', fields: ['title', 'slug', 'excerpt', 'content', 'status'],
    select: 'post_id AS id, title, slug, excerpt, content, status, published_at, created_at, updated_at', search: '(title LIKE ? OR slug LIKE ? OR excerpt LIKE ? OR content LIKE ?)'
  },
  faqs: {
    table: 'content_faqs', id: 'faq_id', fields: ['question', 'slug', 'answer', 'status'],
    select: 'faq_id AS id, question, slug, answer, status, sort_order, created_at, updated_at', search: '(question LIKE ? OR slug LIKE ? OR answer LIKE ?)'
  },
  media: {
    table: 'media_library', id: 'media_id', fields: ['title', 'media_url', 'media_type', 'alt_text'],
    select: 'media_id AS id, title, media_url, media_type, alt_text, created_at', search: '(title LIKE ? OR media_url LIKE ? OR alt_text LIKE ?)'
  }
};

function configFor(type) {
  const config = RESOURCE_CONFIG[type];
  if (!config) throw Object.assign(new Error('Unsupported content type'), { statusCode: 400 });
  return config;
}

async function listContent(type, { page = 1, limit = 50, search = '', status = '' } = {}) {
  const cfg = configFor(type);
  const connection = await pool.getConnection();
  try {
    const conditions = [];
    const params = [];
    if (search) {
      const count = (cfg.search.match(/\?/g) || []).length;
      conditions.push(cfg.search);
      for (let i = 0; i < count; i++) params.push(`%${search}%`);
    }
    if (type !== 'media' && status && ['draft', 'published'].includes(status)) {
      conditions.push('status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const order = type === 'faqs' ? 'sort_order ASC, faq_id DESC' : `${cfg.id} DESC`;
    const rows = await connection.query(`SELECT ${cfg.select} FROM ${cfg.table} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const countRows = await connection.query(`SELECT COUNT(*) AS total FROM ${cfg.table} ${where}`, params);
    const total = Number(countRows[0]?.total || 0);
    const items = rows.map(r => ({ ...r, id: Number(r.id) }));
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  } finally { connection.release(); }
}

function makeSlug(input) {
  return String(input || '').normalize('NFKD').toLowerCase().trim()
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 220);
}

async function uniqueSlug(connection, table, idColumn, slug, excludeId = null) {
  const base = makeSlug(slug) || `content-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (true) {
    const rows = await connection.query(`SELECT ${idColumn} FROM ${table} WHERE slug = ? ${excludeId ? `AND ${idColumn} <> ?` : ''} LIMIT 1`, excludeId ? [candidate, excludeId] : [candidate]);
    if (!rows.length) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

function normalizePayload(type, input = {}) {
  const title = String(input.title ?? input.question ?? '').trim();
  if (type === 'faqs') {
    const answer = String(input.answer ?? '').trim();
    if (!title) throw Object.assign(new Error('FAQ question is required'), { statusCode: 400 });
    if (!answer) throw Object.assign(new Error('FAQ answer is required'), { statusCode: 400 });
    return { title, question: title, slug: String(input.slug || title).trim(), answer, status: input.status === 'published' ? 'published' : 'draft' };
  }
  if (type === 'media') {
    const mediaTitle = String(input.title || '').trim();
    const mediaUrl = String(input.media_url || input.url || '').trim();
    let parsed;
    try { parsed = new URL(mediaUrl); } catch { throw Object.assign(new Error('A valid media URL is required'), { statusCode: 400 }); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw Object.assign(new Error('Media URL must use HTTP or HTTPS'), { statusCode: 400 });
    const mediaType = ['image', 'video', 'document'].includes(input.media_type) ? input.media_type : 'image';
    return { title: mediaTitle || mediaUrl.split('/').pop() || 'Media asset', media_url: mediaUrl, media_type: mediaType, alt_text: String(input.alt_text || '').trim() || null };
  }
  if (!title) throw Object.assign(new Error('Title is required'), { statusCode: 400 });
  const content = String(input.content ?? input.body ?? '').trim();
  return {
    title,
    slug: String(input.slug || title).trim(),
    content,
    excerpt: String(input.excerpt || content.slice(0, 240)).trim(),
    status: input.status === 'published' ? 'published' : 'draft'
  };
}

async function createContent(type, input) {
  const cfg = configFor(type);
  const data = normalizePayload(type, input);
  const connection = await pool.getConnection();
  try {
    if (type === 'media') {
      const result = await connection.query(`INSERT INTO ${cfg.table} (title, media_url, media_type, alt_text) VALUES (?, ?, ?, ?)`, [data.title, data.media_url, data.media_type, data.alt_text]);
      return { id: Number(result.insertId), ...data };
    }
    const slug = await uniqueSlug(connection, cfg.table, cfg.id, data.slug);
    let result;
    if (type === 'faqs') {
      result = await connection.query(`INSERT INTO ${cfg.table} (question, slug, answer, status) VALUES (?, ?, ?, ?)`, [data.question, slug, data.answer, data.status]);
    } else if (type === 'blog') {
      result = await connection.query(`INSERT INTO ${cfg.table} (title, slug, excerpt, content, status, published_at) VALUES (?, ?, ?, ?, ?, IF(? = 'published', CURRENT_TIMESTAMP, NULL))`, [data.title, slug, data.excerpt, data.content, data.status, data.status]);
    } else {
      result = await connection.query(`INSERT INTO ${cfg.table} (title, slug, content, status) VALUES (?, ?, ?, ?)`, [data.title, slug, data.content, data.status]);
    }
    return { id: Number(result.insertId), ...data, slug };
  } finally { connection.release(); }
}

async function updateContent(type, id, input) {
  const cfg = configFor(type);
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) throw Object.assign(new Error('Invalid content ID'), { statusCode: 400 });
  const data = normalizePayload(type, input);
  const connection = await pool.getConnection();
  try {
    const existing = await connection.query(`SELECT ${cfg.id} FROM ${cfg.table} WHERE ${cfg.id} = ? LIMIT 1`, [numericId]);
    if (!existing.length) throw Object.assign(new Error('Content item not found'), { statusCode: 404 });
    let result;
    if (type === 'media') {
      result = await connection.query(`UPDATE ${cfg.table} SET title = ?, media_url = ?, media_type = ?, alt_text = ? WHERE ${cfg.id} = ?`, [data.title, data.media_url, data.media_type, data.alt_text, numericId]);
    } else {
      const slug = await uniqueSlug(connection, cfg.table, cfg.id, data.slug, numericId);
      if (type === 'faqs') result = await connection.query(`UPDATE ${cfg.table} SET question = ?, slug = ?, answer = ?, status = ? WHERE ${cfg.id} = ?`, [data.question, slug, data.answer, data.status, numericId]);
      else if (type === 'blog') result = await connection.query(`UPDATE ${cfg.table} SET title = ?, slug = ?, excerpt = ?, content = ?, status = ?, published_at = IF(? = 'published', COALESCE(published_at, CURRENT_TIMESTAMP), NULL) WHERE ${cfg.id} = ?`, [data.title, slug, data.excerpt, data.content, data.status, data.status, numericId]);
      else result = await connection.query(`UPDATE ${cfg.table} SET title = ?, slug = ?, content = ?, status = ? WHERE ${cfg.id} = ?`, [data.title, slug, data.content, data.status, numericId]);
      data.slug = slug;
    }
    return { id: numericId, ...data };
  } finally { connection.release(); }
}

async function deleteContent(type, id) {
  const cfg = configFor(type);
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) throw Object.assign(new Error('Invalid content ID'), { statusCode: 400 });
  const connection = await pool.getConnection();
  try {
    const result = await connection.query(`DELETE FROM ${cfg.table} WHERE ${cfg.id} = ?`, [numericId]);
    if (!result.affectedRows) throw Object.assign(new Error('Content item not found'), { statusCode: 404 });
    return { id: numericId };
  } finally { connection.release(); }
}

module.exports = { listContent, createContent, updateContent, deleteContent };
