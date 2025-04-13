const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

exports.generateSecret = (req, res) => {
    const secret = speakeasy.generateSecret({ length: 20, name: "ChatApp Verify - UserID 1111" });
    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to generate QR code' });
        }
        res.json({ secret: secret.base32, qrCode: data_url });
    });
};

exports.verifyCode = (req, res) => {
    const { token, secret } = req.body;
    const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token
    });
    if (verified) {
        res.json({ message: 'Code validated' });
    } else {
        res.status(400).json({ message: 'Wrong code' });
    }
};