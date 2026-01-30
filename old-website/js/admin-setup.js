/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Admin Assignment Utility
   
   Run this in the browser console while logged in to make yourself admin.
   
   USAGE:
   1. Log in to PrismMTR with Discord/Google
   2. Open browser console (F12 → Console)
   3. Copy and paste this entire script
   4. Run makeAdmin() to make yourself admin
   5. Run makeAdmin('user@email.com') to make another user admin
   
   This is for initial setup only. Remove this file after configuration.
   ═══════════════════════════════════════════════════════════════════════════ */

async function makeAdmin(email = null) {
  try {
    // Get current user if no email specified
    let targetEmail = email;
    if (!targetEmail) {
      const currentUser = PrismAuth.getUser();
      if (!currentUser) {
        console.error('❌ Not logged in. Please log in first or specify an email.');
        return;
      }
      targetEmail = currentUser.email;
    }
    
    console.log(`🔍 Looking for user: ${targetEmail}`);
    
    // Get all users from JSONBin
    const users = await PrismBin.getUsers(true);
    console.log(`📊 Found ${users.length} users in database`);
    
    // Find the user
    const userIndex = users.findIndex(u => 
      u.email?.toLowerCase() === targetEmail?.toLowerCase()
    );
    
    if (userIndex === -1) {
      console.error(`❌ User not found: ${targetEmail}`);
      console.log('Available users:', users.map(u => u.email).join(', '));
      return;
    }
    
    const user = users[userIndex];
    console.log(`✅ Found user: ${user.nickname || user.email} (current role: ${user.role})`);
    
    if (user.role === 'admin') {
      console.log('ℹ️ User is already an admin!');
      return;
    }
    
    // Update to admin
    users[userIndex].role = 'admin';
    users[userIndex].updatedAt = new Date().toISOString();
    
    // Save back to JSONBin
    await PrismBin.saveUsers(users);
    
    console.log(`🎉 SUCCESS! ${user.email} is now an ADMIN!`);
    console.log('🔄 Refreshing page to apply changes...');
    
    // Refresh to apply changes
    setTimeout(() => location.reload(), 1500);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function listUsers() {
  try {
    const users = await PrismBin.getUsers(true);
    console.table(users.map(u => ({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      createdAt: u.createdAt,
    })));
    return users;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function setRole(email, role) {
  const validRoles = ['user', 'mod', 'admin'];
  if (!validRoles.includes(role)) {
    console.error(`❌ Invalid role. Must be one of: ${validRoles.join(', ')}`);
    return;
  }
  
  try {
    const users = await PrismBin.getUsers(true);
    const userIndex = users.findIndex(u => 
      u.email?.toLowerCase() === email?.toLowerCase()
    );
    
    if (userIndex === -1) {
      console.error(`❌ User not found: ${email}`);
      return;
    }
    
    const oldRole = users[userIndex].role;
    users[userIndex].role = role;
    users[userIndex].updatedAt = new Date().toISOString();
    
    await PrismBin.saveUsers(users);
    
    console.log(`✅ Updated ${email}: ${oldRole} → ${role}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Instructions
console.log('═══════════════════════════════════════════════════════════════');
console.log('🔧 PrismMTR Admin Utility Loaded');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Available commands:');
console.log('  makeAdmin()         - Make yourself admin (must be logged in)');
console.log('  makeAdmin("email")  - Make specific user admin');
console.log('  listUsers()         - List all users');
console.log('  setRole("email", "role") - Set user role (user/mod/admin)');
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
