const detectEmailService = (input) => {
  const emailLower = input.toLowerCase();

  if (emailLower.includes('@gmail.com') || emailLower.includes('google workspace')) {
    return {
      type: 'IMAP',
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authMethod: 'App Password'
    };
  } else if (emailLower.includes('@outlook.com') || emailLower.includes('office365')) {
    return {
      type: 'IMAP',
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      authMethod: 'App Password / OAuth2'
    };
  } else if (emailLower.includes('sendgrid') || emailLower.includes('mailgun')) {
    return {
      type: 'Webhook',
      host: 'Auto-generated Webhook URL',
      port: null,
      tls: true,
      authMethod: 'API Key / Token'
    };
  }
  
  return { type: 'Custom / Unknown', host: '', port: 993, tls: true, authMethod: 'Password' };
};

module.exports = { detectEmailService };