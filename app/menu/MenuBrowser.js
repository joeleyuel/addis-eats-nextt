"use client";
// Client because the search box, the category bar and the pager are interactive
// and the data is fetched with SWR. Three queries' worth of rules live here:
//   browse  key  /api/dishes?category=…&page=N   server data is its first value
//   search  key  /api/dishes?q=…&category=…      null while the box is empty
// Both keep their previous result on screen while the next one loads, so the
// list never flashes empty. Every rule is written down in DATA.md.
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import CategoryBar from "./CategoryBar";
import DishCard from "@/components/DishCard";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import Spinner from "@/components/Spinner";
import Button from "@/components/Button";
import { useDebounce } from "@/components/useDebounce";
import { fetcher } from "@/lib/fetcher";
import { normalizeCategory } from "@/lib/categories";
import { dishesUrl, parsePage } from "@/lib/paging";

// Debounce: typing "tibs" sends one request 300 ms after the last keystroke,
// not four.
const SEARCH_DEBOUNCE_MS = 300;

// Category and page live in the URL (shareable, survives a refresh). The URL is
// changed with the History API — Next.js keeps useSearchParams in sync — so no
// server round trip is needed: SWR fetches the data.
function writeUrl(edit, { push }) {
  const url = new URL(window.location.href);
  edit(url.searchParams);
  window.history[push ? "pushState" : "replaceState"](null, "", url);
}

function pageHref(searchParams, page) {
  const params = new URLSearchParams(searchParams.toString());
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/menu?${qs}` : "/menu";
}

function PageLink({ href, page, disabled, children, ...props }) {
  if (disabled) {
    return (
      <span className="pager__link pager__link--disabled" aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link
      className="pager__link"
      href={href}
      prefetch={false}
      onClick={(event) => {
        // Let the browser handle new-tab / new-window clicks; the href is real.
        // preventDefault also stops <Link> from doing its own (server) navigation.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        writeUrl(
          (params) => (page <= 1 ? params.delete("page") : params.set("page", String(page))),
          { push: true }
        );
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

export default function MenuBrowser({ initialData, initialQuery }) {
  const searchParams = useSearchParams();
  const category = normalizeCategory(searchParams.get("category"));
  const page = parsePage(searchParams.get("page"));

  const [searchInput, setSearchInput] = useState("");
  const term = useDebounce(searchInput, SEARCH_DEBOUNCE_MS).trim();

  // Browsing: the server rendered exactly one key; it is only valid for that key.
  const browseKey = dishesUrl({ category, page });
  const browse = useSWR(browseKey, fetcher, {
    fallbackData: browseKey === dishesUrl(initialQuery) ? initialData : undefined,
    keepPreviousData: true,
    revalidateIfStale: false, // the menu changes a few times a day
    revalidateOnFocus: false,
  });

  // Searching: a null key means "do not fetch" — nothing is searched for nothing.
  const searchKey = term ? dishesUrl({ q: term, category }) : null;
  const search = useSWR(searchKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const searching = term !== "";
  const active = searching ? search : browse;
  // Until the first search answer arrives, keep showing the browse list.
  const data = searching ? search.data ?? browse.data : browse.data;

  function selectCategory(next) {
    writeUrl(
      (params) => {
        if (next === "All") params.delete("category");
        else params.set("category", next);
        params.delete("page"); // a new category starts on page 1
      },
      { push: false }
    );
  }

  function clearFilters() {
    setSearchInput("");
    selectCategory("All");
  }

  let body;
  if (!data && active.error) {
    body = (
      <ErrorState
        title="We couldn't load the dishes"
        message={active.error.message}
        onRetry={() => active.mutate()}
      />
    );
  } else if (!data) {
    body = <Spinner label="Loading the menu…" />;
  } else if (data.items.length === 0) {
    body = (
      <EmptyState
        icon="🔍"
        title="No dishes match your search"
        message="Try a different keyword or clear the category filter."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <p className="menu-count" role="status" aria-live="polite">
          {searching
            ? `${data.total} ${data.total === 1 ? "dish matches" : "dishes match"} “${term}”`
            : `${data.total} ${data.total === 1 ? "dish" : "dishes"} · page ${data.page} of ${data.totalPages}`}
          {active.isValidating && " · updating…"}
        </p>
        {active.error && (
          <p className="menu-error" role="alert">
            Could not refresh — showing the last results. {active.error.message}
          </p>
        )}
        <div className={`grid-cards menu-grid${active.isValidating ? " menu-grid--updating" : ""}`} aria-busy={active.isValidating}>
          {data.items.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
        {!searching && data.totalPages > 1 && (
          <nav className="pager" aria-label="Pagination">
            <PageLink href={pageHref(searchParams, data.page - 1)} page={data.page - 1} disabled={data.page <= 1} rel="prev">
              ← Previous
            </PageLink>
            <span className="pager__status">
              Page {data.page} of {data.totalPages}
            </span>
            <PageLink
              href={pageHref(searchParams, data.page + 1)}
              page={data.page + 1}
              disabled={data.page >= data.totalPages}
              rel="next"
            >
              Next →
            </PageLink>
          </nav>
        )}
      </>
    );
  }

  return (
    <>
      <div className="menu-controls">
        <label className="menu-search">
          <span className="visually-hidden">Search dishes, ingredients, or restaurants</span>
          <input
            type="search"
            placeholder="Search dishes, ingredients…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <CategoryBar active={category} onSelect={selectCategory} />
      </div>
      {body}
    </>
  );
}
