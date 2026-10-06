import { createRouter, defineRoute, defineRoutes, type RouteSectionProps } from "@solidjs/router";
import { component, foreign, type Props, view } from "solid-yield";
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
const Home = component(function* Home(_props: Props<RouteSectionProps<void>>) {
  return view(function* () {
    return (
      <main>
        {yield* ArticleContent({ slug: "overview" })}
        {yield* LikeButton({ slug: "overview" })}
      </main>
    );
  });
});
const DocPage = component(function* DocPage(props: Props<RouteSectionProps<void>>) {
  return view(function* () {
    return (
      <main>
        {yield* ArticleContent({ slug: props.params.slug })}
        {yield* LikeButton({ slug: props.params.slug })}
      </main>
    );
  });
});
const Router = createRouter({
  routes: defineRoutes([
    defineRoute({ path: "/", component: foreign(Home) }),
    defineRoute({ path: "/docs/:slug", component: foreign(DocPage) })
  ])
});
const App = component(function* App(props: Props<{ url?: string }>) {
  return view(function* () {
    return (
      <div class="site">
        <header>
          <a href="/">Field Notes</a>
          {yield* ThemeToggle()}
          {yield* SearchBox()}
        </header>
        <div class="layout">
          <aside>{yield* SiteNav()}</aside>
          <div>
            <Router url={yield* props.url} />
          </div>
        </div>
        {yield* NewsletterForm()}
        {yield* CommentList()}
        {yield* ImageCarousel()}
        {yield* ReadingGuide()}
        {yield* SiteFooter()}
      </div>
    );
  });
});
export default App;
