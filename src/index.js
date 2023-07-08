const fs = require('fs');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const credentials = JSON.parse(fs.readFileSync('./credentials.json'));
const { client_secret, client_id, redirect_uris } = credentials.web;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'vinit9email@gmail.com',
    clientId: client_id,
    clientSecret: client_secret,
    refreshToken: credentials.refresh_token,
    accessToken: '', // Leave this empty for now
  },
});

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

async function authorize() {
  try {
    const token = await readFileAsync('token.json');
    oAuth2Client.setCredentials(JSON.parse(token));

    if (!oAuth2Client.credentials.access_token || oAuth2Client.isTokenExpired()) {
      const tokenResponse = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(tokenResponse.credentials);
      await writeFileAsync('token.json', JSON.stringify(tokenResponse.credentials));
    }

    transporter.options.auth.accessToken = oAuth2Client.credentials.access_token;
  } catch (error) {
    console.error('Authorization failed. Please check credentials and try again.');
  }
}

async function sendReply(email) {
  const mailOptions = {
    from: 'vinit9email@gmail.com',
    to: email.from,
    subject: 'Auto Reply',
    text: 'Thank you for your email. I am currently out of the office and will respond as soon as possible.',
  };

  await transporter.sendMail(mailOptions);
}

async function addLabelToEmail(emailId, labelName) {
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    resource: { addLabelIds: [labelName] },
  });
}

async function checkEmailsAndSendReplies() {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
    });

    const emails = response.data.messages || [];

    const replyPromises = emails.map(async (email) => {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: email.id,
      });

      const emailThread = message.data.threadId;
      const replies = message.data.payload.headers.filter(
        (header) => header.name === 'From' && header.value === 'your-email@gmail.com'
      );

      if (replies.length === 0) {
        await sendReply(message.data.payload.headers.find((header) => header.name === 'Reply-To').value);
        await addLabelToEmail(email.id, 'AutoReplied');
      }
    });

    await Promise.all(replyPromises);
  } catch (error) {
    console.error('Error checking emails and sending replies:', error);
  }
}

async function runApp() {
  try {
    await authorize();
    setInterval(checkEmailsAndSendReplies, getRandomInterval());
  } catch (error) {
    console.error('Error running the app:', error);
  }
}

function getRandomInterval() {
  return Math.floor(Math.random() * (120 - 45 + 1)) + 45;
}

runApp();
