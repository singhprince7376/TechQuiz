const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  level: Number,
  question: String,
  options: [String],
  answer: Number
});

module.exports = mongoose.model('Question', questionSchema);
