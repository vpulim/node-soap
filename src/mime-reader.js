//Original code from Yaron Naveh, 
//https://github.com/yaronn/ws.js/
//modified to support large files using a temp local file

const MultipartParser = require('formidable/lib/multipart_parser.js').MultipartParser
  , fs = require('fs')

const MimeReader = {

  parse_multipart: function(payload, boundary) {
    const parts = []
    const part
    const data
    const headers = []
    const curr_header_name
    const curr_header_value
    const fd
    const tempId

    const parser = new MultipartParser()
    parser.initWithBoundary(boundary)

    parser.onPartBegin = function() {
      part = {}
      headers = []
      curr_header_name = ""
      curr_header_value = ""
        
      //only open a file for writing if we are after the first part ie the message otherwise use a buffer
      if(parts.length == 0){
          data = new Buffer('');
      } else {
          tempId = Math.floor(new Date()).toString() + ".bin";
          fd = fs.openSync(tempId, 'a+');
      }
    }

    parser.onHeaderField = function(b, start, end) {
      curr_header_name = b.slice(start, end).toString()
    };

    parser.onHeaderValue = function(b, start, end) {
      curr_header_value = b.slice(start, end).toString()
    }

    parser.onHeaderEnd = function() {
      headers[curr_header_name.toLowerCase()] = curr_header_value
    }
    
    parser.onHeadersEnd = function() { }
    
    parser.onPartData = function(b, start, end) {
        //treat first part as xml message
        if(parts.length == 0){
            data = Buffer.concat([data, b.slice(start, end)]);
        } else {
            //write parts directly to file instead of a buffer, to be able to work with large attachments
            fs.appendFileSync(fd, b.slice(start, end));
        }
    }

    parser.onPartEnd = function() {
        //treat first part as xml message
        if(parts.length == 0){
            part.data = data;
        } else {
            part.localTmpFile = tempId;
            fs.closeSync(fd);
        }

      part.headers = headers
      parts.push(part)
    }
    
    parser.onEnd = function() {}
    parser.write(payload)
    return parts
  },
}

exports.parse_multipart = function(payload, boundary)
{
  return MimeReader.parse_multipart(payload, boundary)
}