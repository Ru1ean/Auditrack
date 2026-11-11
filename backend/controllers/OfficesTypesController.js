const db = require("../db"); // promise pool

const OfficeTypesController = {
  getAll: async (req, res) => {
    try {
      const [results] = await db.query("SELECT * FROM officetypes");
      res.json(results);
    } catch (err) {
      console.error("Error fetching office types:", err);
      res.status(500).json({ error: "Database error" });
    }
  },

  getById: async (req, res) => {
    const id = req.params.id;
    try {
      const [results] = await db.query("SELECT * FROM officetypes WHERE officetypeid = ?", [id]);
      if (results.length === 0) return res.status(404).json({ message: "Office type not found" });
      res.json(results[0]);
    } catch (err) {
      console.error("Error fetching office type:", err);
      res.status(500).json({ error: "Database error" });
    }
  },

  create: async (req, res) => {
    const { typename } = req.body;
    if (!typename) return res.status(400).json({ error: "typename is required" });

    try {
      const [result] = await db.query("INSERT INTO officetypes (typename) VALUES (?)", [typename]);
      res.status(201).json({ officetypeid: result.insertId, typename });
    } catch (err) {
      console.error("Error creating office type:", err);
      res.status(500).json({ error: "Database error" });
    }
  },

  update: async (req, res) => {
    const id = req.params.id;
    const { typename } = req.body;
    if (!typename) return res.status(400).json({ error: "typename is required" });

    try {
      const [result] = await db.query("UPDATE officetypes SET typename = ? WHERE officetypeid = ?", [typename, id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: "Office type not found" });
      res.json({ message: "Office type updated successfully" });
    } catch (err) {
      console.error("Error updating office type:", err);
      res.status(500).json({ error: "Database error" });
    }
  },

  delete: async (req, res) => {
    const id = req.params.id;
    try {
      const [result] = await db.query("DELETE FROM officetypes WHERE officetypeid = ?", [id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: "Office type not found" });
      res.json({ message: "Office type deleted successfully" });
    } catch (err) {
      console.error("Error deleting office type:", err);
      res.status(500).json({ error: "Database error" });
    }
  },
};

module.exports = OfficeTypesController;
