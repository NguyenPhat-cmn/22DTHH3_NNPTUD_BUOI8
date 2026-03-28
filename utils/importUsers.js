const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const crypto = require('crypto');
const User = require('../schemas/users');
const Role = require('../schemas/roles');
const { sendPasswordEmail } = require('./mailHandler');

mongoose.connect('mongodb://localhost:27017/NNPTUD-S4');

function genPassword() {
    return crypto.randomBytes(12).toString('base64').slice(0, 16);
}

async function importUsers() {
    await mongoose.connection.once('open', () => {});

    const userRole = await Role.findOne({ name: 'user' }) || await Role.create({ name: 'user', description: 'Người dùng thông thường' });

    const users = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(__dirname + '/users.csv')
            .pipe(csv())
            .on('data', (row) => users.push(row))
            .on('end', resolve)
            .on('error', reject);
    });

    for (const { username, email } of users) {
        const exists = await User.findOne({ $or: [{ username }, { email }] });
        if (exists) {
            console.log(`Skip (đã tồn tại): ${username}`);
            continue;
        }
        const password = genPassword();
        const user = new User({ username, email, password, role: userRole._id });
        await user.save();
        await sendPasswordEmail(email, username, password);
        console.log(`Đã tạo và gửi email: ${username} <${email}> | password: ${password}`);
    }

    console.log('Hoàn tất import users!');
    mongoose.disconnect();
}

importUsers().catch(err => { console.error(err); mongoose.disconnect(); });
