const express = require("express");
const router = express.Router();
const OfficesController = require("../controllers/OfficesController");
const { auth, restrictAuditor, restrictAuditorDownloads } = require("../middleware/auth");
const rateLimit = require('../middleware/rateLimit');

// Office Routes
router.get("/", auth, rateLimit({ windowMs: 60 * 1000, max: 40 }), OfficesController.getAll);
router.get("/:id/export", auth, restrictAuditorDownloads, OfficesController.exportOfficeExcel);
router.get("/:id", auth, OfficesController.getById);
router.post("/", auth, restrictAuditor, OfficesController.create);
router.put("/:id", auth, restrictAuditor, OfficesController.update);
router.put("/:id/level", auth, restrictAuditor, OfficesController.updateLevel);
router.post("/delete-multiple", auth, restrictAuditor, OfficesController.deleteMultiple);
router.delete("/delete-multiple", auth, restrictAuditor, OfficesController.deleteMultiple);
router.delete("/", auth, restrictAuditor, OfficesController.deleteMultiple);
router.delete("/:id", auth, restrictAuditor, OfficesController.delete);

// Office Requirements Routes
router.get("/:id/requirements", auth, OfficesController.getOfficeRequirements);
router.post("/:id/requirements", auth, restrictAuditor, OfficesController.addOfficeRequirements);
router.put("/:id/requirements/:requirementid/status", auth, OfficesController.updateRequirementStatus);
router.delete("/:id/requirements/:requirementid", auth, restrictAuditor, OfficesController.removeOfficeRequirement);

module.exports = router;

