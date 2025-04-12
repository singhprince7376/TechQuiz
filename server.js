require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Question = require('./models/Question');
const path = require('path');
const app = express();

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected'));
const quizSession = {};
let userProgress = 1; // to track question progress per level


app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

let adminLoggedIn = false;

// Home / Level list / Result
app.get('/', async (req, res) => {
  const levels = await Question.distinct('level');
  res.render('index', { levels: levels.sort((a, b) => a - b), userProgress, currentLevel: null, questions: null, quizOver: false, score: null });
});

// Load quiz

app.get('/quiz', async (req, res) => {
  const level = parseInt(req.query.level);
  if (!quizSession[level]) {
    const questions = await Question.aggregate([
      { $match: { level } },
      { $sample: { size: 20 } }
    ]);
    quizSession[level] = {
      questions,
      currentIndex: 0,
      score: 0
    };
  }

  const session = quizSession[level];

  if (session.currentIndex >= 10) {
    const score = session.score;
    if (score >= 8 && userProgress <= level) {
      userProgress = level + 1;
    }
    delete quizSession[level];
    const levels = await Question.distinct('level');
    return res.render('index', { 
      levels, 
      userProgress, 
      currentLevel: level, 
      questions: null, 
      quizOver: true, 
      score, 
      currentQuestionNumber: 10 
    });
  }

  const question = session.questions[session.currentIndex];
  const levels = await Question.distinct('level');
  res.render('index', {
    levels,
    userProgress,
    currentLevel: level,
    questions: [question],
    quizOver: false,
    score: null,
    currentQuestionNumber: session.currentIndex + 1
  });
});

// Handle submission
app.post('/quiz', (req, res) => {
  const level = parseInt(req.body.level);
  const selected = parseInt(req.body.answers[0]);

  const session = quizSession[level];
  if (!session || session.currentIndex >= 10) {
    return res.redirect('/');
  }

  const currentQuestion = session.questions[session.currentIndex];

  if (selected === currentQuestion.answer) {
    session.score++;
  }

  session.currentIndex++;
  return res.redirect(`/quiz?level=${level}`);
});


// Admin login
app.get('/admin', async (req, res) => {
  const questions = await Question.find();
  res.render('admin', { loggedIn: adminLoggedIn, error: null, questions });
});

app.post('/admin', async (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    adminLoggedIn = true;
    const questions = await Question.find();
    res.render('admin', { loggedIn: true, error: null, questions });
  } else {
    res.render('admin', { loggedIn: false, error: 'Wrong password', questions: [] });
  }
});

// Add question
app.post('/admin/add', async (req, res) => {
  if (!adminLoggedIn) return res.redirect('/admin');
  const { level, question, options, answer } = req.body;
  const q = new Question({
    level,
    question,
    options: options.split('\n'),
    answer: parseInt(answer)
  });
  await q.save();
  const questions = await Question.find();
  res.render('admin', { loggedIn: true, error: null, questions });
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));
