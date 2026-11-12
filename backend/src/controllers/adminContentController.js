const { listContent, createContent, updateContent, deleteContent } = require('../services/adminContentService');

const TYPES = new Set(['pages', 'blog', 'faqs', 'media']);
function typeFrom(req, res) {
  const type = req.params.type;
  if (!TYPES.has(type)) { res.status(404).json({ success: false, message: 'Content type not found' }); return null; }
  return type;
}
function handleError(error, res, next) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A record with this value already exists' });
  return next(error);
}
async function list(req, res, next) {
  const type = typeFrom(req, res); if (!type) return;
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 150) : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const data = await listContent(type, { page, limit, search, status });
    return res.json({ success: true, message: `${type} fetched successfully`, data });
  } catch (error) { return handleError(error, res, next); }
}
async function create(req, res, next) {
  const type = typeFrom(req, res); if (!type) return;
  try { const data = await createContent(type, req.body); return res.status(201).json({ success: true, message: 'Content created successfully', data }); }
  catch (error) { return handleError(error, res, next); }
}
async function update(req, res, next) {
  const type = typeFrom(req, res); if (!type) return;
  try { const data = await updateContent(type, req.params.id, req.body); return res.json({ success: true, message: 'Content updated successfully', data }); }
  catch (error) { return handleError(error, res, next); }
}
async function remove(req, res, next) {
  const type = typeFrom(req, res); if (!type) return;
  try { const data = await deleteContent(type, req.params.id); return res.json({ success: true, message: 'Content deleted successfully', data }); }
  catch (error) { return handleError(error, res, next); }
}
module.exports = { list, create, update, remove };
