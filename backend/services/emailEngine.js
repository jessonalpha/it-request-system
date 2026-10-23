const imapSimple = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const { analyzeEmailContent } = require('./ticketRouter');

// --- 1. IMAP PULL ENGINE ---
const startImapListener = async (config) => {
  const imapConfig = {
    imap: {
      user: config.email,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      authTimeout: 3000
    }
  };

  try {
    const connection = await imapSimple.connect(imapConfig);
    await connection.openBox('INBOX');

    // Poll every 60 seconds
    setInterval(async () => {
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };
      
      const messages = await connection.search(searchCriteria, fetchOptions);
      
      for (let item of messages) {
        const all = item.parts.find(part => part.which === 'TEXT');
        const parsed = await simpleParser(all.body);
        
        // Pass to your ticket creation logic
        const { category, priority } = analyzeEmailContent(parsed.subject, parsed.text);
        console.log(`[IMAP] Creating ticket: ${parsed.subject}`);
        // Create DB Request here...
      }
    }, 60000);

  } catch (err) {
    console.error(`[IMAP Error] ${config.email}:`, err);
  }
};

// --- 2. WEBHOOK PUSH CONTROLLER ---
// (Mounted in your express routes e.g., app.use('/api/webhooks', webhookRoutes))
const handleWebhookPush = async (req, res) => {
  // SendGrid / Mailgun parse payloads
  const senderEmail = req.body.from;
  const subject = req.body.subject;
  const textBody = req.body.text;

  const { category, priority } = analyzeEmailContent(subject, textBody);
  console.log(`[WEBHOOK] Creating ticket: ${subject}`);
  // Create DB Request here...
  
  res.status(200).send('Processed');
};

module.exports = { startImapListener, handleWebhookPush };