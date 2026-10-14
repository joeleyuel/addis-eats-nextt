// Server component: static markup carried over from Day 35.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <p className="brand">
            <span aria-hidden="true">🍲</span> Addis Eats
          </p>
          <p>Connecting the culinary heart of Addis Ababa to your dining table, delivered fast.</p>
        </div>
        <div>
          <h4>Service Neighborhoods</h4>
          <p>Bole &amp; Medhanialem</p>
          <p>Kazanchis &amp; Guinea Conakry</p>
          <p>Piassa &amp; Arada</p>
        </div>
        <div>
          <h4>Payment Methods</h4>
          <p>Telebirr Direct Pay</p>
          <p>CBE Birr &amp; Mobile Banking</p>
          <p>Cash on Hand-off (ETB)</p>
        </div>
        <div>
          <h4>Support &amp; Inquiries</h4>
          <p>Call Center: 8122 (Toll Free)</p>
          <p>support@addiseats.et</p>
        </div>
      </div>
      <div className="container site-footer__bottom">
        © {new Date().getFullYear()} Addis Eats Delivery Service. All rights reserved.
      </div>
    </footer>
  );
}
