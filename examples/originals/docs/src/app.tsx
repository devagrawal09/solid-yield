import { createRouter, defineRoute, defineRoutes, type RouteSectionProps } from "@solidjs/router";
import { SiteNav, SiteFooter, ArticleContent, ReadingGuide } from "./content";
import {
  ThemeToggle,
  SearchBox,
  LikeButton,
  NewsletterForm,
  CommentList,
  ImageCarousel
} from "./widgets";
import "./app.css";
function Home() {
  return (
    <main>
      <ArticleContent slug="overview" />
      <LikeButton slug="overview" />
    </main>
  );
}
function DocPage(props: RouteSectionProps) {
  return (
    <main>
      <ArticleContent slug={props.params.slug} />
      <LikeButton slug={props.params.slug} />
    </main>
  );
}
const Router = createRouter({
  routes: defineRoutes([
    defineRoute({ path: "/", component: Home }),
    defineRoute({ path: "/docs/:slug", component: DocPage })
  ])
});
export default function App(props: { url?: string }) {
  return (
    <div class="site">
      <header>
        <a href="/">Field Notes</a>
        <ThemeToggle />
        <SearchBox />
      </header>
      <div class="layout">
        <aside>
          <SiteNav />
        </aside>
        <div>
          <Router url={props.url} />
        </div>
      </div>
      <NewsletterForm />
      <CommentList />
      <ImageCarousel />
      <ReadingGuide />
      <SiteFooter />
    </div>
  );
}
