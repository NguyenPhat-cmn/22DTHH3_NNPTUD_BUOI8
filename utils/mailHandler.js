const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
        user: 'd65e02ef456669',
        pass: '5833844f8fe6a4'
    }
});

async function sendPasswordEmail(email, username, password) {
    await transporter.sendMail({
        from: '"Admin" <admin@haha.com>',
        to: email,
        subject: 'Tài khoản của bạn đã được tạo',
        text: `Xin chào ${username},\n\nTài khoản của bạn đã được tạo.\nUsername: ${username}\nPassword: ${password}\n\nVui lòng đổi mật khẩu sau khi đăng nhập.`
    });
}

module.exports = { sendPasswordEmail };
