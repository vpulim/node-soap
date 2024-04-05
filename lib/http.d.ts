/// <reference types="node" />
/// <reference types="node" />
import * as req from 'axios';
import { ReadStream } from 'fs';
import { IExOptions, IHeaders, IHttpClient, IOptions } from './types';
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
export declare class HttpClient implements IHttpClient {
    private _request;
    private options;
    constructor(options?: IOptions);
    /**
     * Build the HTTP request (method, uri, headers, ...)
     * @param {String} rurl The resource url
     * @param {Object|String} data The payload
     * @param {Object} exheaders Extra http headers
     * @param {Object} exoptions Extra options
     * @returns {Object} The http request object for the `request` module
     */
    buildRequest(rurl: string, data: any, exheaders?: IHeaders, exoptions?: IExOptions): any;
    /**
     * Handle the http response
     * @param {Object} The req object
     * @param {Object} res The res object
     * @param {Object} body The http body
     * @param {Object} The parsed body
     */
    handleResponse(req: req.AxiosPromise, res: req.AxiosResponse, body: any): any;
    request(rurl: string, data: any, callback: (error: any, res?: any, body?: any) => any, exheaders?: IHeaders, exoptions?: IExOptions, caller?: any): req.AxiosPromise<any>;
    requestStream(rurl: string, data: any, exheaders?: IHeaders, exoptions?: IExOptions, caller?: any): req.AxiosPromise<ReadStream>;
}
