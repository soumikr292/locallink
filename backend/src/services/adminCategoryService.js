const { pool } = require("../config/database");


// Get categories
async function getCategories({
  page = 1,
  limit = 20,
  search = "",
  status = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`
        (
          c.name LIKE ?
          OR c.slug LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(searchValue, searchValue);
    }

    if (status) {
      conditions.push("c.status = ?");
      params.push(status);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countRows = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM categories c
      ${whereClause}
      `,
      params
    );

    const rows = await connection.query(
      `
      SELECT
        c.category_id,
        c.name,
        c.slug,
        c.description,
        c.image_url,
        c.parent_id,
        c.status,
        c.created_at,
        c.updated_at,

        p.name AS parent_name

      FROM categories c

      LEFT JOIN categories p
        ON c.parent_id = p.category_id

      ${whereClause}

      ORDER BY c.category_id DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      items: rows.map((category) => ({
        id: Number(category.category_id),
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.image_url,
        parentId: category.parent_id
          ? Number(category.parent_id)
          : null,
        parentName: category.parent_name,
        status: category.status,
        createdAt: category.created_at,
        updatedAt: category.updated_at
      })),

      pagination: {
        page,
        limit,
        total: Number(countRows[0].total),
        totalPages: Math.ceil(
          Number(countRows[0].total) / limit
        )
      }
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Create category
async function createCategory({
  name,
  slug,
  description,
  imageUrl,
  parentId,
  status = "active"
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    if (parentId !== null) {
      const parentRows = await connection.query(
        `
        SELECT category_id
        FROM categories
        WHERE category_id = ?
        LIMIT 1
        `,
        [parentId]
      );

      if (parentRows.length === 0) {
        const error = new Error(
          "Parent category not found"
        );

        error.statusCode = 400;

        throw error;
      }
    }

    const existingRows = await connection.query(
      `
      SELECT category_id
      FROM categories
      WHERE slug = ?
      LIMIT 1
      `,
      [slug]
    );

    if (existingRows.length > 0) {
      const error = new Error(
        "Category slug already exists"
      );

      error.statusCode = 409;

      throw error;
    }

    const result = await connection.query(
      `
      INSERT INTO categories (
        name,
        slug,
        description,
        image_url,
        parent_id,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        slug,
        description,
        imageUrl,
        parentId,
        status
      ]
    );

    return {
      id: Number(result.insertId),
      name,
      slug,
      description,
      imageUrl,
      parentId,
      status
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Update category
async function updateCategory({
  categoryId,
  name,
  slug,
  description,
  imageUrl,
  parentId,
  status
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const categoryRows = await connection.query(
      `
      SELECT category_id
      FROM categories
      WHERE category_id = ?
      LIMIT 1
      `,
      [categoryId]
    );

    if (categoryRows.length === 0) {
      const error = new Error(
        "Category not found"
      );

      error.statusCode = 404;

      throw error;
    }

    if (parentId !== null) {
      if (Number(parentId) === Number(categoryId)) {
        const error = new Error(
          "Category cannot be its own parent"
        );

        error.statusCode = 400;

        throw error;
      }

      const parentRows = await connection.query(
        `
        SELECT category_id
        FROM categories
        WHERE category_id = ?
        LIMIT 1
        `,
        [parentId]
      );

      if (parentRows.length === 0) {
        const error = new Error(
          "Parent category not found"
        );

        error.statusCode = 400;

        throw error;
      }
    }

    const duplicateRows = await connection.query(
      `
      SELECT category_id
      FROM categories
      WHERE slug = ?
      AND category_id != ?
      LIMIT 1
      `,
      [slug, categoryId]
    );

    if (duplicateRows.length > 0) {
      const error = new Error(
        "Category slug already exists"
      );

      error.statusCode = 409;

      throw error;
    }

    await connection.query(
      `
      UPDATE categories
      SET
        name = ?,
        slug = ?,
        description = ?,
        image_url = ?,
        parent_id = ?,
        status = ?
      WHERE category_id = ?
      `,
      [
        name,
        slug,
        description,
        imageUrl,
        parentId,
        status,
        categoryId
      ]
    );

    return {
      id: Number(categoryId),
      name,
      slug,
      description,
      imageUrl,
      parentId,
      status
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Deactivate category
async function deleteCategory(categoryId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `
      SELECT category_id
      FROM categories
      WHERE category_id = ?
      LIMIT 1
      `,
      [categoryId]
    );

    if (rows.length === 0) {
      const error = new Error(
        "Category not found"
      );

      error.statusCode = 404;

      throw error;
    }

    await connection.query(
      `
      UPDATE categories
      SET status = 'inactive'
      WHERE category_id = ?
      `,
      [categoryId]
    );

    return {
      id: Number(categoryId),
      status: "inactive"
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


async function reactivateCategory(categoryId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `
      UPDATE categories
      SET status = 'active'
      WHERE category_id = ?
      `,
      [categoryId]
    );

    if (result.affectedRows === 0) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      id: Number(categoryId),
      status: "active"
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reactivateCategory
};