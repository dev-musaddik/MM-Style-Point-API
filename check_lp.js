const mongoose = require('mongoose');
require('dotenv').config();
const LandingPage = require('./models/LandingPage');

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    const pages = await LandingPage.find({});
    console.log('Landing Pages Count:', pages.length);
    console.log('Landing Pages:', JSON.stringify(pages, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

checkDB();
