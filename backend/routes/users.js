const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const userController = require('../controllers/usersController');
const { auth, requireAdmin } = require("../middleware/auth");
const rateLimit = require('../middleware/rateLimit');

const profilePicsDir = path.join(__dirname, '../uploads/profile-pics');
if (!fs.existsSync(profilePicsDir)) {
    fs.mkdirSync(profilePicsDir, { recursive: true });
}
const multerStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, profilePicsDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
	}
});
const upload = multer({ storage: multerStorage });

// upload profile
router.put('/:id', auth, upload.single('profilepic'), userController.updateUser);

// Update approval status (admin only)
router.put('/:id/approval-status', auth, requireAdmin, userController.updateApprovalStatus);

// Update user role (admin only)
router.put('/:id/role', auth, requireAdmin, userController.updateUserRole);

router.get("/me", auth, userController.getLoggedInUser);
router.use(express.json());

// User authentication routes
router.post('/change-password/send-otp', auth, userController.sendChangePasswordOtp);
router.post('/change-password/verify-and-change', auth, userController.verifyAndChangePassword);
router.post('/registration-invite', auth, userController.createRegistrationInvite);
router.get('/registration-invite/:token', userController.validateRegistrationInvite);
router.post('/send-registration-otp', userController.sendRegistrationOtp);
router.post('/verify-registration-otp', userController.verifyRegistrationOtp);
router.post('/register', userController.registerUser);
router.get('/login-status', userController.loginStatus);
router.post('/login', userController.loginUser);
router.post('/logout', auth, userController.logoutUser);

// User data routes (protected)
router.get('/', auth, requireAdmin, rateLimit({ windowMs: 60 * 1000, max: 30 }), userController.getUsers);
router.get('/current/:email', auth, userController.getCurrentUser);

// Bulk delete users (admin only)
router.delete('/', auth, requireAdmin, userController.deleteUsers);

// Serve profile-pics statically
const expressApp = require('express');
router.use('/uploads/profile-pics', expressApp.static('uploads/profile-pics'));

module.exports = router;
