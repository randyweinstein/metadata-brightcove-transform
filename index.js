const config = require('./config')
var Promise = require('promise')
var nbright = require('nbright');
var builder = require('xmlbuilder');


var oAuthClient = new nbright.OAuth(config.brightcove.client_id, config.brightcove.secret);
var videoClient = new nbright.Video(config.brightcove.account, oAuthClient);


/**
 * Model
 * We define two objects to be populated and marshalled to the output format. In this initial version, the objects are populated by calls to the brightcove
 * API,  and the output format is MRSS. In future versions, mutiple data sources (thePlatform) and multiple output formats (CSV) may be requested. 
 */
var contentPrototype = {
  url: 'http://www.foo.ca',
  duration: 0,
  type: 'video/MP4',
  expression: 'full',
  medium: 'video'
}

var mediaPrototype = {
  id: 0,
  title: '',
  description: '',
  link: 'http://www.foo.ca'
}
mediaPrototype.content = contentPrototype

/**
 * This is the main entry point
 */
var transformBCtoMRSS = function getSingleVideo() {

  return videoClient.getVideos({limit: 4})
    .then(buildMedias)
    .then(addContentToAllMedia)
    .then(generateMRSS)
    .then(function(mrss){
      console.log("done: " + mrss);
    })
    .catch(errorHandler)

  }

var errorHandler = function(error){
  console.log(error)
}
  
/**
 * Creates Media Objects from nBright response
 * @todo populate thumbnais
 * @param {Promise} videos 
 * Alison wanted:
 *     Video name
*         Description
*         Video source file (highest quality MP4)
*         Image
*         Custom headline
*         Tags
*         Source
*         Related link
*         Related Link text 2 (The Loop’s respective site section)
*         Publish date
*         Expiry date
 */
function buildMedias(videos){
  return new Promise(function(resolve, reject) {
    try {
      var medias = [];
      for(var i in videos){
        var media = Object.create(mediaPrototype)
        media.id = videos[i].id
        media.title = videos[i].name
        media.description = videos[i].description
        thumbnail = {}
        //todo get thumbmnail
        //console.log(videos[i])
        medias.push(media);
      }
      resolve(medias)
    } catch(error) {
      reject(error)
    }
  }); 
}

/**
 * We need to make a separate call to the Brightcove API for each media to retrieve the links to the MP4s.
 * @param {*} medias the array of medias to flesh out with sources
 * @returns {promise} 
 */
function addContentToAllMedia(medias){
  return Promise.all(medias.map(addContentToSingleMedia))
}

/**
 * Populates content sources
 * @param {media} media 
 * @returns {promise} 
 */
 
function addContentToSingleMedia(media){
  return new Promise (function (resolve, reject){
    videoClient.getVideoSources(media.id)
    .then(function(sources){
      var mp4Sources = sources.filter(contentFilter);
      mp4Sources.sort(function(a, b){return b.size - a.size});
      if(mp4Sources.size == 0) reject(Error("Media has no suitable content"))
      content = Object.create(contentPrototype)
      content.url = mp4Sources[0].src
      content.duration = mp4Sources[0].duration
      media.content = content
      resolve(media)
    })
  })
}

/**
 * This is a comparator that filters out media that we can't use. We accept only non-SSL mp4s
 *
 * @param {String} value The URL we are filtering 
 * @param {*} i not used.
 */
var contentFilter = function (value, i) {
  if(value.remote == true) return false
  if(!value.hasOwnProperty('src')) return false
  if(!value.src.startsWith('http')) return false
  if(value.src.startsWith('https')) return false
  if(value.src.indexOf("mp4") == -1) return false
  if(value.src.indexOf("master.m3u8") != -1 ) return false
  return true
}

/**
 * This function uses xmlbuilder to build MRSS 
 * @param {*} medias the array of media to marshal into MRSS
 * @returns {promise} 
 */
var generateMRSS = function (medias){
  return new Promise(function(resolve, reject) {
    try {
      var mrss = builder.create('rss', { encoding: 'utf-8' })
      .att('xmlns:media', 'http://search.yahoo.com/mrss/')
      .att('version', '2.0')
      .ele('channel')
      .ele('title','BrightCove Feed').up()
      .ele('link','https://docs.brightcove.com/cms-api/v1/doc/index.html').up()
      .ele('description','This feed originates from the Brightcove CMS API').up()
      for (var i in medias){
        mrss.ele('item')
          .ele('title', medias[i].title).up()
          .ele('description', medias[i].description).up()
          .ele('link', medias[i].link).up()
          .ele('media:content')
            .att('url', medias[i].content.url)
            .att('duration', medias[i].content.duration)
            .att('type', medias[i].content.type)
            .att('expression', medias[i].content.expression)
            .att('medium', medias[i].content.medium)
            .up()

        .up()
      }      
      resolve(mrss.end({pretty: true}) )
    } catch (error) {
      reject(error)
    }
  })
}

transformBCtoMRSS();
