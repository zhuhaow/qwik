import { getClientDataPath } from './utils';
import { dispatchPrefetchEvent } from './client-navigate';
import { CLIENT_DATA_CACHE } from './constants';
import type { ClientPageData, RouteActionValue } from './types';
import { _deserializeData } from '@builder.io/qwik';

export const loadClientData = async (
  href: string,
  clearCache?: boolean,
  action?: RouteActionValue
) => {
  const url = new URL(href);
  const pagePathname = url.pathname;
  const pageSearch = url.search;
  const clientDataPath = getClientDataPath(pagePathname, pageSearch, action);
  let qData = undefined;
  if (!action) {
    qData = CLIENT_DATA_CACHE.get(clientDataPath);
  }

  dispatchPrefetchEvent({
    links: [pagePathname],
  });

  if (!qData) {
    const actionData = action?.data;
    if (action) {
      action.data = undefined;
    }
    const options: RequestInit | undefined = actionData
      ? {
          method: 'POST',
          body: actionData,
        }
      : undefined;
    qData = fetch(clientDataPath, options).then((rsp) => {
      const redirectedURL = new URL(rsp.url);
      if (redirectedURL.origin !== location.origin || !isQDataJson(redirectedURL.pathname)) {
        location.href = redirectedURL.href;
        return;
      }
      if ((rsp.headers.get('content-type') || '').includes('json')) {
        // we are safe we are reading a q-data.json
        return rsp.text().then((text) => {
          const clientData = _deserializeData(text) as ClientPageData;
          if (clientData.__brand !== 'qdata') {
            return;
          }
          if (clearCache) {
            CLIENT_DATA_CACHE.delete(clientDataPath);
          }
          if (clientData.redirect) {
            location.href = clientData.redirect;
          } else if (action) {
            const actionData = clientData.loaders[action.id];
            action.resolve!({ status: rsp.status, result: actionData });
          }
          return clientData;
        });
      } else {
        CLIENT_DATA_CACHE.delete(clientDataPath);
      }
    });

    if (!action) {
      CLIENT_DATA_CACHE.set(clientDataPath, qData);
    }
  }

  return qData;
};

export const isQDataJson = (pathname: string) => {
  return pathname.endsWith(QDATA_JSON);
};

export const QDATA_JSON = '/q-data.json';
