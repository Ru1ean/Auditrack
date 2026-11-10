const db = require('../db');

// Get all users controller
exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT u.userid, u.firstname, u.middleinitial, u.lastname, u.Email, u.roleid, u.profilepic, r.rolename FROM users u LEFT JOIN roles r ON u.roleid = r.roleid'
    );
    
    // Add combined FullName to each user
    const usersWithFullName = users.map(user => ({
      ...user,
      FullName: `${user.firstname}${user.middleinitial ? ' ' + user.middleinitial + '.' : ''} ${user.lastname}`
    }));
    
    res.json({
      success: true,
      users: usersWithFullName
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users'
    });
  }
};
