const mongoose = require('mongoose');

const uri = "mongodb+srv://geminih1301_db_user:50kpfRCZrkoWe65m@cluster0.ehalwhd.mongodb.net/?appName=Cluster0";

const landingPageSchema = new mongoose.Schema({
  slug: String,
  title: String,
  isActive: Boolean
});
const LandingPage = mongoose.model('LandingPage', landingPageSchema);

const checkDB = async () => {
  try {
    await mongoose.connect(uri);
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
