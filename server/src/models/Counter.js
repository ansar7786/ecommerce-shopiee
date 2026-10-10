const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 1000,
  },
});

counterSchema.statics.getNextOrderNo = async function () {
  const counter = await this.findByIdAndUpdate(
    'order',
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `KR-${counter.seq}`;
};

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
