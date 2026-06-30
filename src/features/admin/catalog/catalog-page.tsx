import { CatalogList } from './catalog-list';

/** /catalog — admin screen to manage the platform-service catalog (the
 *  services projects can deploy). Thin wrapper so the route can lazy-load it. */
export default function CatalogPage() {
  return <CatalogList />;
}
