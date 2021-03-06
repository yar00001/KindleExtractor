var express = require('express');
var router = express.Router();
var logger = require('../logger/log');
var dic = require('./../dic/dictionary');
var prettyHtml = require('json-pretty-html').default;

// Database
var dbhandler = require('../db/sqliteWrapper');

const asyncMiddleware = fn =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };

/* GET upload handler. */
router.get('/', asyncMiddleware(async (req, res, next) => {

  console.log("got the get request");

  let bookName = req.query.name;
  let dbPath = req.query.dbfile;
  let startTime = req.query.startTime;
  let endTime = req.query.endTime;

  console.log("bookname and db file path", bookName, dbPath);

  console.log("+++++++++++ QUERY +++++++++", req.query);

  if (!bookName || !dbPath) {
    logger.error("[BOOK-RESULT] Required information are empty!");
    res.send("Required information are empty!");
  }

  logger.info('[BOOK-RESULT] Preparing the result from file for book  started.');

  // Open the Uploaded DB Connection
  await openDBConnection(dbPath);
  // Retrieving the Data
  var allWordsDetails
  if (startTime && endTime) {
    console.log(`doing query from ${startTime} - ${endTime}`);
    allWordsDetails = await waitForWordsByTime(bookName, startTime, endTime);
  } else {
    console.log(`doing query from without any time being set`);
    await waitForWordsByName(bookName);
  }
  console.log("done waiting for words: ", allWordsDetails.length);
  // Retrieving all the definitions
  var allDefinitions = await lookupDefinitions(allWordsDetails);
  console.log("done waiting for dictionary: ", allDefinitions);

  res.render('result', {
    'title': 'Results',
    'book' : bookName,
    'words': allWordsDetails,
    'definitionDict': allDefinitions
  });
}));

async function openDBConnection(dbPath) {
  await dbhandler.getConnection(dbPath);
}

async function waitForWordsByName(bookName) {
  var result = await dbhandler.queryWordsByBookName(bookName);
  console.log("after wait result", result);
  return result;
}

async function waitForWordsByTime(bookName, startTime, endTime) {
  var result = await dbhandler.queryWordsByBookNameAndTime(bookName, startTime, endTime);
  console.log("after wait result", result);
  return result;
}

async function lookupDefinitions(wordDetails) {
  var dictResult = {};

  for (const wd of wordDetails) {
    let word = wd.word;
    var defRes = await dic.lookupWordPromisify(word);
    dictResult[word] = prettyHtml(refineResults(defRes.data));
    console.log("got the definition!", defRes.data);
  }

  return dictResult;
}

function refineResults(rawInput) {
  var resultArray = rawInput.results;
  var arr = [];
  for (const item of resultArray) {
    var res = {};

    if (item.part_of_speech) {
      res.part_of_speech = item.part_of_speech;
    }

    if (item.pronunciations) {
      var pronArray = item.pronunciations;
      for (const p of pronArray) {
        if (p.ipa) {
          res.pronunciations = p.ipa;
        }
      }
    }

    if (item.senses) {
      var senses = item.senses;
      for (const s of senses) {
        if (s.definition) {
          res.definition = s.definition;
        }
        if (s.examples) {
          for (e of s.examples) {
            if (e.text) {
              res.examples = e.text;
            }
          }          
        }
      }
    }

    arr.push(res);
  }

  return arr;
}

module.exports = router;