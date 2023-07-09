const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const client_id = '414934956451-qpttsfui0ngkafbk6i1p6b472i0caf9f.apps.googleusercontent.com';
const client_secret = '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';
const redirect_uris = ['https://developers.google.com/oauthplayground'];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'vinit9email@gmail.com',
    clientId: client_id,
    clientSecret: client_secret,
    refreshToken: '1//04lVoEqkL5CCGCgYIARAAGAQSNwF-L9Iru3ENshxmOLXh47wjJy0el81vLyXOqFI83e_W4NYuyAwWyDZRqnvMj0q_LG4DEubakvk',
    accessToken: '',
  },
});

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

async function authorize() {
  try {
    const token = '{}';
    oAuth2Client.setCredentials(JSON.parse(token));

    if (oAuth2Client.isTokenExpiring()) {
      const tokenResponse = await oAuth2Client.getAccessToken();
      oAuth2Client.setCredentials(tokenResponse.token);
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

    for (const email of emails) {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: email.id,
      });

      const emailThread = message.data.threadId;
      const replies = message.data.payload.headers.filter(
        (header) => header.name === 'From' && header.value === 'vinit9email@gmail.com'
      );

      if (replies.length === 0) {
        await sendReply(message.data.payload.headers.find((header) => header.name === 'Reply-To').value);
        await addLabelToEmail(email.id, 'AutoReplied');
      }
    }
  } catch (error) {
    console.error('Error checking emails and sending replies:', error);
  }
}

async function runApp() {
  try {
    await authorize();
    setInterval(async () => {
      await checkEmailsAndSendReplies();
    }, getRandomInterval());
  } catch (error) {
    console.error('Error running the app:', error);
  }
}

function getRandomInterval() {
  return Math.floor(Math.random() * (120 - 45 + 1)) + 45;
}

runApp();
