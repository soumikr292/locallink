const express = require("express");
const { pool } = require("../config/database");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const rows = await connection.query(
      `SELECT category_id, name, slug, description, image_url, parent_id, status
       FROM categories
       WHERE status = 'active'
       ORDER BY parent_id IS NOT NULL, name ASC`
    );

    return res.status(200).json({
      success: true,
      data: rows.map((c) => ({
        id: Number(c.category_id),
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.image_url,
        parentId: c.parent_id !== null ? Number(c.parent_id) : null,
        status: c.status
      }))
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
