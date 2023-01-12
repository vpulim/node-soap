/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

import * as req from 'axios';
import { NtlmClient } from 'axios-ntlm';
import * as debugBuilder from 'debug';
import { ReadStream } from 'fs';
import * as url from 'url';
import { v4 as uuidv4 } from 'uuid';
import MIMEType = require('whatwg-mimetype');
import { gzipSync } from 'zlib';
import { IExOptions, IHeaders, IHttpClient, IOptions } from './types';
import { parseMTOMResp } from './utils';

const debug = debugBuilder('node-soap');
const VERSION = require('../package.json').version;

export interface IAttachment {
  name: string;
  contentId: string;
  mimetype: string;
  body: NodeJS.ReadableStream;
}

/**
 * A class representing the http client
 * @param {Object} [options] Options object. It allows the customization of
 * `request` module
 *
 * @constructor
 */
export class HttpClient implements IHttpClient {

  private _request: req.AxiosInstance;
  private options: IOptions;

  constructor(options?: IOptions) {
    options = options || {};
    this.options = options;
    this._request = options.request || req.default.create();
  }

  /**
   * Build the HTTP request (method, uri, headers, ...)
   * @param {String} rurl The resource url
   * @param {Object|String} data The payload
   * @param {Object} exheaders Extra http headers
   * @param {Object} exoptions Extra options
   * @returns {Object} The http request object for the `request` module
   */
  public buildRequest(rurl: string, data: any, exheaders?: IHeaders, exoptions: IExOptions = {}): any {
    const curl = url.parse(rurl);
    const method = data ? 'POST' : 'GET';

    const host = curl.hostname;
    const port = parseInt(curl.port, 10);
    const headers: IHeaders = {
      'User-Agent': 'node-soap/' + VERSION,
      'Accept': 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'none',
      'Accept-Charset': 'utf-8',
      'Connection': exoptions.forever ? 'keep-alive' : 'close',
      'Host': host + (isNaN(port) ? '' : ':' + port),
    };
    const mergeOptions = ['headers'];

    const { attachments: _attachments, ...newExoptions } = exoptions;
    const attachments: IAttachment[] = _attachments || [];

    if (typeof data === 'string' && attachments.length === 0 && !exoptions.forceMTOM) {
      headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    exheaders = exheaders || {};
    for (const attr in exheaders) {
      headers[attr] = exheaders[attr];
    }

    const options: req.AxiosRequestConfig = {
      url: curl.href,
      method: method,
      headers: headers,
      transformResponse: (data) => data,
    };
    if (!exoptions.ntlm) {
      options.validateStatus = null;
    }
    if (exoptions.forceMTOM || attachments.length > 0) {
      const start = uuidv4();
      let action = null;
      if (headers['Content-Type'].indexOf('action') > -1) {
        for (const ct of headers['Content-Type'].split('; ')) {
          if (ct.indexOf('action') > -1) {
            action = ct;
          }
        }
      }
      const boundary = uuidv4();
      headers['Content-Type'] = 'multipart/related; type="application/xop+xml"; start="<' + start + '>"; start-info="text/xml"; boundary=' + boundary;
      if (action) {
        headers['Content-Type'] = headers['Content-Type'] + '; ' + action;
      }
      const multipart: any[] = [{
        'Content-Type': 'application/xop+xml; charset=UTF-8; type="text/xml"',
        'Content-ID': '<' + start + '>',
        'body': data,
      }];

      attachments.forEach((attachment) => {
        multipart.push({
          'Content-Type': attachment.mimetype,
          'Content-Transfer-Encoding': 'binary',
          'Content-ID': '<' + attachment.contentId + '>',
          'Content-Disposition': 'attachment; filename="' + attachment.name + '"',
          'body': attachment.body,
        });
      });
      options.data = `--${boundary}\r\n`;

      let multipartCount = 0;
      multipart.forEach((part) => {
        Object.keys(part).forEach((key) => {
          if (key !== 'body') {
            options.data += `${key}: ${part[key]}\r\n`;
          }
        });
        options.data += '\r\n';
        options.data += `${part.body}\r\n--${boundary}${
          multipartCount === multipart.length - 1 ? '--' : ''
        }\r\n`;
        multipartCount++;
      });
    } else {
      options.data = data;
    }

    if (exoptions.forceGzip) {
      options.decompress = true;
      options.data = gzipSync(options.data);
      options.headers['Accept-Encoding'] = 'gzip,deflate';
      options.headers['Content-Encoding'] = 'gzip';
    }

    for (const attr in newExoptions) {
      if (mergeOptions.indexOf(attr) !== -1) {
        for (const header in exoptions[attr]) {
          options[attr][header] = exoptions[attr][header];
        }
      } else {
        options[attr] = exoptions[attr];
      }
    }
    debug('Http request: %j', options);
    return options;
  }

  /**
   * Handle the http response
   * @param {Object} The req object
   * @param {Object} res The res object
   * @param {Object} body The http body
   * @param {Object} The parsed body
   */
  public handleResponse(req: req.AxiosPromise, res: req.AxiosResponse, body: any) {
    debug('Http response body: %j', body);
    if (typeof body === 'string') {
      // Remove any extra characters that appear before or after the SOAP envelope.
      const regex = /(?:<\?[^?]*\?>[\s]*)?<([^:]*):Envelope([\S\s]*)<\/\1:Envelope>/i;
      const match = body.replace(/<!--[\s\S]*?-->/, '').match(regex);
      if (match) {
        body = match[0];
      }
    }
    return body;
  }

  public request(
    rurl: string,
    data: any,
    callback: (error: any, res?: any, body?: any) => any,
    exheaders?: IHeaders,
    exoptions?: IExOptions,
    caller?,
  ) {
    const options = this.buildRequest(rurl, data, exheaders, exoptions);
    let req: req.AxiosPromise;
    if (exoptions !== undefined && exoptions.ntlm) {
      const ntlmReq = NtlmClient({
        username: exoptions.username,
        password: exoptions.password,
        workstation: exoptions.workstation || '',
        domain: exoptions.domain || '',
      });
      req = ntlmReq(options);
    } else {
      if (this.options.parseReponseAttachments) {
        options.responseType = 'arraybuffer';
        options.responseEncoding = 'binary';
      }
      req = this._request(options);
    }
    const _this = this;
    req.then((res) => {

      const handleBody = (body?: string) => {
        res.data = this.handleResponse(req, res, body || res.data);
        callback(null, res, res.data);
        return res;
      };

      if (_this.options.parseReponseAttachments) {
        const isMultipartResp = res.headers['content-type'] && res.headers['content-type'].toLowerCase().indexOf('multipart/related') > -1;
        if (isMultipartResp) {
          let boundary;
          const parsedContentType = MIMEType.parse(res.headers['content-type']);
          if (parsedContentType) {
            boundary = parsedContentType.parameters.get('boundary');
          }
          if (!boundary) {
            return callback(new Error('Missing boundary from content-type'));
          }
          return parseMTOMResp(res.data, boundary, (err, multipartResponse) => {
            if (err) {
              return callback(err);
            }
              // first part is the soap response
            const firstPart = multipartResponse.parts.shift();
            if (!firstPart || !firstPart.body) {
              return callback(new Error('Cannot parse multipart response'));
            }
            (res as any).mtomResponseAttachments = multipartResponse;
            return handleBody(firstPart.body.toString('utf8'));
          });
        } else {
          return handleBody(res.data.toString('utf8'));
        }
      } else {
        return handleBody();
      }
    }, (err) => {
      return callback(err);
    });
    return req;
  }

  public requestStream(rurl: string, data: any, exheaders?: IHeaders, exoptions?: IExOptions, caller?): req.AxiosPromise<ReadStream> {
    const options = this.buildRequest(rurl, data, exheaders, exoptions);
    options.responseType = 'stream';
    const req = this._request(options).then((res) => {
      res.data = this.handleResponse(req, res, res.data);
      return res;
    });
    return req;
  }
}
