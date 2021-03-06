import React from 'react';
import Loadable from 'react-loadable';
import { renderToString } from 'react-dom/server';
import App from '../src/Containers/App.jsx';
import { Router } from 'react-router-dom';
import reducers from '../src/reducers/index';
import { getCreateStore } from '../src/store';
import { Provider } from 'react-redux';
import path from 'path';
import fs from 'fs';
import Helmet from 'react-helmet';
import { getBundles } from 'react-loadable/webpack';
import stats from '../build/react-loadable.json';

import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

const prepHTML = (data, { html, head, style, body, script, styleTags, state }) => {
  data = data.replace('<html', `<html ${html}`);
  data = data.replace('</head>', `${head}</head>`);
  data = data.replace(
    '<body>',
    `<body><script>
		window._INIT_STATE_ = ${JSON.stringify(state)};
		</script>`
  );
  data = data.replace('<div id="root"></div>', `<div id="root">${body}</div>${style}${styleTags}`);
  data = data.replace('</body>', `${script}</body>`);
  return data;
};

const render = async (ctx, next) => {
  const filePath = path.resolve(__dirname, '../build/index.html');

  let htmlData = fs.readFileSync(filePath, 'utf8');

  const { store, history } = getCreateStore(reducers, ctx.req.url);

  const sheet = new ServerStyleSheet();
  //初始请求数据
  //await initalActions(store,ctx.req.url,initialRequestConfig)
  let modules = [];
  const AppRender = (
    <Loadable.Capture report={moduleName => modules.push(moduleName)}>
      <StyleSheetManager sheet={sheet.instance}>
        <Provider store={store}>
          <Router history={history}>
            <App />
          </Router>
        </Provider>
      </StyleSheetManager>
    </Loadable.Capture>
  );

  let routeMarkup = renderToString(AppRender);

  const initialState = store.getState();
  let bundles = getBundles(stats, modules);

  const styleTags = sheet.getStyleTags();

  let styles = bundles.filter(bundle => bundle.file.endsWith('.css'));
  let scripts = bundles.filter(bundle => bundle.file.endsWith('.js'));

  // link 样式转内联样式
  let styleTagStr = '';
  styles
    .map(style => {
      styleTagStr += fs.readFileSync(path.join(__dirname, '../build', `/${style.file}`), 'utf8');
    })
    .join('\n');
  styleTagStr = `<style id="jss-server-side" type="text/css">${styleTagStr}</style>`;

  let scriptTagStr = scripts
    .map(bundle => {
      return `<script src="/${bundle.file}"></script>`;
    })
    .join('\n');

  const helmet = Helmet.renderStatic();
  const html = prepHTML(htmlData, {
    html: helmet.htmlAttributes.toString(),
    head: helmet.title.toString() + helmet.meta.toString() + helmet.link.toString(),
    style: styleTagStr,
    body: routeMarkup,
    script: scriptTagStr,
    styleTags,
    state: initialState,
  });
  ctx.body = html;
};

export default render;
