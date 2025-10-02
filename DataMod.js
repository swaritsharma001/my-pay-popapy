const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({
  Id: { 
    type: String, 
    required: true,
    unique: true 
  },
  Owo: { 
    type: String, 
    required: true 
  }
});

const DataMod = mongoose.model('DataMod', dataSchema)

module.exports = DataMod