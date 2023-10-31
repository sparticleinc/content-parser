import URL from 'url';
import cheerio from 'cheerio';
import TurndownService from 'turndown';

import Resource from 'resource';
import { validateUrl } from 'utils';
import addCustomExtractor from 'extractors/add-extractor';
import getExtractor from 'extractors/get-extractor';
import RootExtractor, { selectExtendedTypes } from 'extractors/root-extractor';
import collectAllPages from 'extractors/collect-all-pages';

const Parser = {
  async parse(url, { html, ...opts } = {}) {
    const {
      fetchAllPages = true,
      fallback = true,
      contentType = 'html',
      headers = {},
      extend,
      customExtractor,
    } = opts;

    // if no url was passed and this is the browser version,
    // set url to window.location.href and load the html
    // from the current page
    if (!url && cheerio.browser) {
      url = window.location.href; // eslint-disable-line no-undef
      html = html || cheerio.html();
    }

    const parsedUrl = URL.parse(url);

    if (!validateUrl(parsedUrl)) {
      return {
        error: true,
        message:
          'The url parameter passed does not look like a valid URL. Please check your URL and try again.',
      };
    }

    const $ = await Resource.create(url, html, parsedUrl, headers);

    // If we found an error creating the resource, return that error
    if ($.failed) {
      return $;
    }

    // Add custom extractor via cli.
    if (customExtractor) {
      addCustomExtractor(customExtractor);
    }

    const Extractor = getExtractor(url);
    // console.log(`Using extractor for ${JSON.stringify(Extractor)}`);

    // if html still has not been set (i.e., url passed to Parser.parse),
    // set html from the response of Resource.create
    if (!html) {
      html = $.html();
    }

    // Cached value of every meta name in our document.
    // Used when extracting title/author/date_published/dek
    const metaCache = $('meta')
      .map((_, node) => $(node).attr('name'))
      .toArray();

    let extendedTypes = {};
    if (extend) {
      extendedTypes = selectExtendedTypes(extend, { $, url, html });
    }

    let result = RootExtractor.extract(Extractor, {
      url,
      html,
      $,
      metaCache,
      parsedUrl,
      fallback,
      contentType,
    });

    const { title, next_page_url } = result;

    // Fetch more pages if next_page_url found
    if (fetchAllPages && next_page_url) {
      result = await collectAllPages({
        Extractor,
        next_page_url,
        html,
        $,
        metaCache,
        result,
        title,
        url,
      });
    } else {
      result = {
        ...result,
        total_pages: 1,
        rendered_pages: 1,
      };
    }

    if (contentType === 'markdown') {
      const turndownService = new TurndownService();
      result.content = turndownService.turndown(result.content);
    } else if (contentType === 'text') {
      result.content = $.text($(result.content));
    }

    // 如果当前url没有匹配到任何extractor，返回原始的html作为content
    if (!Extractor) {
      result.content = html;
    }

    // 把获取到的Extractor也返回，让外部程序也可以利用extractor配置文件。
    return { ...result, ...extendedTypes, Extractor };
  },

  browser: !!cheerio.browser,

  // A convenience method for getting a resource
  // to work with, e.g., for custom extractor generator
  fetchResource(url) {
    return Resource.create(url);
  },

  addExtractor(extractor) {
    return addCustomExtractor(extractor);
  },
};

export default Parser;
