// The seller shown with a public listing: which users columns are selected (SELLER_COLUMNS, for a query with
// `JOIN users u ON l.seller_id = u.id`) and how the flat row becomes { ...listing, seller: {...} } (withSeller),
// the shape the frontend expects (l.seller.username). Shared by the feed, the archive, the search and the detail
// in routes/listings.js. Only public profile fields: never e-mail, address or anything private.
const SELLER_COLUMNS = `u.username as seller_username,
              u.avatar_url as seller_avatar,
              u.rating_avg as seller_rating,
              u.is_verified as seller_is_verified,
              u.is_pro as seller_is_pro,
              u.seller_type as seller_seller_type,
              u.company_name as seller_company_name`;

/** A row selected with SELLER_COLUMNS -> the listing's own fields plus `seller`. Other columns are kept as they are. */
function withSeller(row) {
  const {
    seller_username, seller_avatar, seller_rating, seller_is_verified, seller_is_pro,
    seller_seller_type, seller_company_name, ...listing
  } = row;
  return {
    ...listing,
    seller: {
      username: seller_username,
      avatar_url: seller_avatar,
      rating_avg: seller_rating,
      is_verified: seller_is_verified ?? false,
      is_pro: seller_is_pro ?? false,
      seller_type: seller_seller_type ?? null,
      company_name: seller_company_name ?? null,
    },
  };
}

module.exports = { SELLER_COLUMNS, withSeller };
