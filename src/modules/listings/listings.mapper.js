// Row -> JSON for the public listing reads (feed, archive, search, detail). The repository selects the seller's
// public profile with SELLER_COLUMNS as flat seller_* columns; the frontend expects them nested (l.seller.username).
// Only public profile fields: never e-mail, address or anything private.

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

module.exports = { withSeller };
