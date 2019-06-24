/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

import * as debugBuilder from 'debug';
import * as httpNtlm from 'httpntlm';
import * as _ from 'lodash';
import * as req from 'request';
import * as url from 'url';
import * as uuid from 'uuid/v4';
import { IHeaders, IOptions } from './types';

const debug = debugBuilder('node-soap');
const VERSION = require('../package.json').version;

export interface IExOptions {
  [key: string]: any;
}

export interface IAttachment {
  name: string;
  contentId: string;
  mimetype: string;
  body: NodeJS.ReadableStream;
}

export type Request = req.Request;

/**
 * A class representing the http client
 * @param {Object} [options] Options object. It allows the customization of
 * `request` module
 *
 * @constructor
 */
export class HttpClient {
  private _request: req.RequestAPI<req.Request, req.CoreOptions, req.Options>;

  constructor(options?: IOptions) {
    options = options || {};
    this._request = options.request || req;
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
    const secure = curl.protocol === 'https:';
    const host = curl.hostname;
    const port = parseInt(curl.port, 10);
    const path = [curl.pathname || '/', curl.search || '', curl.hash || ''].join('');
    const method = data ? 'POST' : 'GET';
    const headers: IHeaders = {
      'User-Agent': 'node-soap/' + VERSION,
      'Accept': 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'none',
      'Accept-Charset': 'utf-8',
      'Connection': exoptions.forever ? 'keep-alive' : 'close',
      'Host': host + (isNaN(port) ? '' : ':' + port),
    };
    const mergeOptions = ['headers'];
    const attachments: IAttachment[] = exoptions.attachments || [];

    if (typeof data === 'string' && attachments.length === 0) {
      headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    exheaders = exheaders || {};
    for (const attr in exheaders) {
      headers[attr] = exheaders[attr];
    }

    const options: req.Options = {
      uri: curl,
      method: method,
      headers: headers,
      followAllRedirects: true,
    };

    if (attachments.length > 0) {
      const start = uuid();
      headers['Content-Type'] =
        'multipart/related; type="application/xop+xml"; start="<' + start + '>"; start-info="text/xml"; boundary=' + uuid();
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
      options.multipart = multipart;
    } else {
      options.body = data;
    }

    for (const attr in _.omit(exoptions, ['attachments'])) {
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
  public handleResponse(req: req.Request, res: req.Response, body: any) {
    debug('Http response body: %j', body);
    if (typeof body === 'string') {
      // Remove any extra characters that appear before or after the SOAP
      // envelope.
      const match =
        body.replace(/<!--[\s\S]*?-->/, '').match(/(?:<\?[^?]*\?>[\s]*)?<([^:]*):Envelope([\S\s]*)<\/\1:Envelope>/i);
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
    let req: req.Request;

    if (exoptions !== undefined && exoptions.hasOwnProperty('ntlm')) {
      // sadly when using ntlm nothing to return
      // Not sure if this can be handled in a cleaner way rather than an if/else,
      // will to tidy up if I get chance later, patches welcome - insanityinside
      // TODO - should the following be uri?
      options.url = rurl;
      httpNtlm[options.method.toLowerCase()](options, (err, res) => {
        if (err) {
          return callback(err);
        }
        // if result is stream
        if ( typeof res.body !== 'string') {
          res.body = res.body.toString();
        }
        res.body = this.handleResponse(req, res, res.body);
        callback(null, res, res.body);
      });
    } else {
      req = this._request(options, (err, res, body) => {
        if (err) {
          return callback(err);
        }
        body = this.handleResponse(req, res, body);
        callback(null, res, body);
      });
    }

    return req;
  }

  public requestStream(rurl: string, data: any, exheaders?: IHeaders, exoptions?: IExOptions, caller?): req.Request {
    const options = this.buildRequest(rurl, data, exheaders, exoptions);
    return this._request(options);
  }
}
