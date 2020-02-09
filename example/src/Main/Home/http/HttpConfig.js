import React from 'react';
import {RNStorage} from '../../Common/storage/AppStorage';
import {RFApi, RFApiConst} from 'react-native-fast-app';
import {isEmpty, selfOr} from '../../Common/utils/Utils';
import {ApiCredit, ApiO2O} from './Api';
import AuthToken from './AuthToken';
import {showToast} from '../../Common/widgets/Loading';

/**
 * RN Http请求 库设置类
 */
export default class HttpConfig {

    static initDemo() {//非站内、非标准请求
        RFApi.default = {
            httpLogOn: true,
        };
    }

    static initO2O() {
        RFApi.default = {
            httpLogOn: true,
            baseUrl: ApiO2O.baseUrl,
            contentType: RFApiConst.CONTENT_TYPE_URLENCODED,
            paramSetFunc: (params, request) => {
                if (request.internal && !isEmpty(RNStorage.accessToken)) {
                    params.access_token = RNStorage.accessToken;
                }
            },
            parseDataFunc: (result, request, callback) => {
                DebugManager.httpLogs(request, result);//调试工具记录日志
                let {success, json, message, status} = result;
                if (status === 401) {//Token过期
                    showToast('token过期，请重新登录');
                } else {
                    let {data, errorCode, msg, extra} = json;
                    callback(success && 'SUCCESS'.equals(errorCode), selfOr(data, {}), selfOr(msg, message), errorCode);
                }
            },
        };
    }


    static initCredit() {
        RFApi.default = {
            httpLogOn: true,
            baseUrl: ApiCredit.baseUrl,
            contentType: RFApiConst.CONTENT_TYPE_URLENCODED,
            headerSetFunc: (headers, request) => {
                if (request.internal) {
                    Object.assign(headers, AuthToken.baseHeaders());//添加基础参数
                    headers.customerId = RNStorage.customerId;
                    if (RNStorage.refreshToken) {//若refreshToken不为空，则拼接
                        headers['access-token'] = RNStorage.accessToken;
                        headers['refresh-token'] = RNStorage.refreshToken;
                    }
                }
            },
            paramSetFunc: (params, request) => {
                if (request.internal && RNStorage.customerId) {
                    params.CUSTOMER_ID = RNStorage.customerId;
                }
            },
            parseDataFunc: async (result, request, callback) => {
                let {success, json, response, message, status} = result;
                AuthToken.parseTokenRes(response);//解析token
                if (status === 503) {//指定的Token过期标记
                    if (isEmpty(RNStorage.refreshToken) || isEmpty(RNStorage.customerId)) {
                        showToast('Token过期，退出登录');
                    }
                    await AuthToken.getAccessToken().then(() => {//获取到新Token后，retry失败的接口
                        request.resendRequest(request, callback);
                    });
                } else {
                    let {successful, msg, code} = json;
                    callback(success && successful === 1, selfOr(json.data, {}), selfOr(msg, message), code);
                }
            },
        };
    }


}