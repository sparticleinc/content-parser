import Extractors from './all';
import { apiExtractors } from './add-extractor';

/**
 * 根据URL查找对应的抽取器。
 *
 * 匹配的规则是： 1 && 2
 * 1. 域名匹配
 * 2. 路径匹配（但多个路径是或的关系，只要匹配一个即可） 支持正则
 */
export default function getExtractor(url) {
  const apiExtractorsKeys = Object.keys(apiExtractors);
  const extractorsKeys = Object.keys(Extractors);

  const key = apiExtractorsKeys.concat(extractorsKeys).find(domain => {
    const domainMatch = url.includes(domain);
    const extractor = apiExtractors[domain] || Extractors[domain];

    if (!domainMatch) return false;

    // 如果没有声明includedPaths，意味着只要域名匹配就可以
    if (!extractor.includedPaths) return true;

    // 匹配任意一个路径即可
    return extractor.includedPaths.some(path => {
      const reg = new RegExp(path);
      return reg.test(url);
    });
  });

  return Extractors[key] || apiExtractors[key];
}
