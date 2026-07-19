const express = require('express');
const nodemailer = require('nodemailer');
const Message = require('../models/Message');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/contact
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'Name, email, and message are all required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'Please provide a valid email address.' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ ok: false, error: 'Message is too long.' });
    }

    // 1. Save to MongoDB
    const saved = await Message.create({ name, email, message });

    // 2. Try to send an email notification (optional — skipped if SMTP env vars are absent)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Portfolio Contact Form" <${process.env.SMTP_USER}>`,
          to: process.env.CONTACT_RECEIVER || process.env.SMTP_USER,
          replyTo: email,
          subject: `New portfolio message from ${name}`,
          text: message,
          html: `<p><strong>From:</strong> ${name} (${email})</p><p>${message}</p>`,
        });
      } catch (mailErr) {
        // Don't fail the whole request just because email delivery failed —
        // the message is already safely stored in MongoDB.
        console.error('Email send failed:', mailErr.message);
      }
    }

    return res.status(201).json({ ok: true, id: saved._id });
  } catch (err) {
    console.error('Contact route error:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again later.' });
  }
});

module.exports = router;
