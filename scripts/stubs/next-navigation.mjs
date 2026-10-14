// redirect()/notFound() throw in Next.js to stop rendering; the stand-ins do the same
// so a test can see WHERE the real code tried to send the visitor.
export class Redirected extends Error {
  constructor(url) {
    super(`NEXT_REDIRECT ${url}`);
    this.url = url;
  }
}
export class NotFound extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
export function redirect(url) {
  throw new Redirected(url);
}
export function notFound() {
  throw new NotFound();
}
