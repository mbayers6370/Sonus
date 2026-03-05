import { useEffect } from 'react';

type SEOHeadProps = {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
};

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
}

export default function SEOHead({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogUrl,
  twitterTitle,
  twitterDescription,
}: SEOHeadProps) {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertCanonical(canonical);

    upsertMeta('property', 'og:title', ogTitle ?? title);
    upsertMeta('property', 'og:description', ogDescription ?? description);
    upsertMeta('property', 'og:url', ogUrl ?? canonical);

    upsertMeta('name', 'twitter:title', twitterTitle ?? ogTitle ?? title);
    upsertMeta('name', 'twitter:description', twitterDescription ?? ogDescription ?? description);
  }, [
    canonical,
    description,
    ogDescription,
    ogTitle,
    ogUrl,
    title,
    twitterDescription,
    twitterTitle,
  ]);

  return null;
}
