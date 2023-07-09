const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const OAuth2 = google.auth.OAuth2;
const SCOPES = ['https://mail.google.com'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function checkEmailsAndSendReplies() {
  const client = await authorize();
  const gmail = google.gmail({ version: 'v1', auth: client });

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
  });

  if (!res.data.messages) {
    console.log('No unread emails found.');
    return;
  }

  const messages = res.data.messages;

  const email = 'vinit9email@gmail.com';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: email,
      clientId: client._clientId,
      clientSecret: client._clientSecret,
      refreshToken: client.credentials.refresh_token,
      accessToken: client.credentials.access_token,
    },
  });

  for (const message of messages) {
    const messageRes = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
    });

    const from = messageRes.data.payload.headers.find(
      (header) => header.name === 'From'
    ).value;
    const fromEmail = from.substring(from.indexOf('<') + 1, from.indexOf('>'));
    const subject = messageRes.data.payload.headers.find(
      (header) => header.name === 'Subject'
    ).value;

    const mailOptions = {
      from: email,
      to: fromEmail,
      subject: `Re: ${subject}`,
      text:
        'Thank you for your email. I am currently out of the office and will respond as soon as possible. \n\n This is an automated reply.',
    };

    await transporter.sendMail(mailOptions);

    await gmail.users.messages.modify({
      userId: 'me',
      id: message.id,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });

    console.log(`Sent reply to ${fromEmail}`);
  }

  console.log('Done.');
}

checkEmailsAndSendReplies();
