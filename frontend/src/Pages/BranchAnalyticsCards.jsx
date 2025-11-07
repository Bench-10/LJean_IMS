import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import api from '../utils/api';

// 👇 import your six images from src/assets/images
import img1 from '../assets/images/camsbranch.png';
import img2 from '../assets/images/eljeanbranch.png';
import img3 from '../assets/images/marajeanbranch.png';
import img4 from '../assets/images/sethbranch.png';
import img5 from '../assets/images/vinsethbranch.png';
import img6 from '../assets/images/ljeanbranch.png';

// Optional: map by branch_id (edit ids to match your data)
const IMAGE_BY_ID = { 1: img6, 2: img5, 3: img3, 4: img2, 5: img1, 6: img4 };
// Also keep an ordered array for index-based fallback
const IMAGE_LIST = [img1, img2, img3, img4, img5, img6];

function BranchAnalyticsCards() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadBranches(); }, []);
  async function loadBranches() {
    try {
      setLoading(true); setError(null);
      const res = await api.get(`/api/analytics/branches`);
      setBranches(res.data);
    } catch (e) { setError('Failed to load branches'); }
    finally { setLoading(false); }
  }

return (
    <main className="bg-[#eef2ee]">
      {/* Scroll container = viewport height minus the fixed header (pt-20 = 5rem) */}
      <section className="overflow-y-auto min-h-[calc(100svh-5rem)]">
        <div className="pt-20 lg:pt-3 px-4 lg:px-8 pb-10 w-full">
          <div className="flex items-center mb-4">
            <NavLink
              to="/dashboard"
              className="flex gap-x-2 items-center px-3 lg:px-4 py-1.5 lg:py-2 border-2 bg-white font-medium rounded-md text-green-800 border-gray-200 transition-all hover:bg-green-100"
            >
              <IoArrowBack />
              <span className="text-sm">Back to Overview</span>
            </NavLink>
          </div>

          <h1 className="text-lg font-semibold text-gray-700 mb-4">Select a Branch</h1>

          {loading && <div className="text-sm text-gray-500">Loading branches...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}

          {/* GRID does NOT scroll; the page (section) scrolls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((b, idx) => {
              const imgSrc = IMAGE_BY_ID[b.branch_id] ?? IMAGE_LIST[idx % IMAGE_LIST.length];
              return (
                <section key={b.branch_id} className="bg-white p-5 border border-green-600/50 rounded-md">
                  <div className="w-full h-36 md:h-40 rounded-sm overflow-hidden bg-gray-100">
                    <img
                      src={imgSrc}
                      alt={`${b.branch_name} image`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = img1; }}
                    />
                  </div>

                  <div className="flex flex-col text-center mt-4">
                    <h2 className="text-green-700 text-md font-bold">{b.branch_name}</h2>
                    <p className="text-xs text-gray-700">{b.address}</p>
                    <div className="mt-3">
                      <button
                        onClick={() => navigate(`/branch-analytics/${b.branch_id}`)}
                        className="w-full border border-green-700 bg-green-50 hover:bg-green-600 hover:text-white transition-colors py-2 px-5 rounded-md text-sm text-green-800 font-semibold"
                      >
                        View Analytics
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}

            {!loading && !error && branches.length === 0 && (
              <div className="text-sm text-gray-500">No branches found.</div>
            )}
          </div>

          {/* extra bottom space so last row isn't hidden behind OS bars / toasts */}
          <div className="h-8 md:h-10 pb-[env(safe-area-inset-bottom)]" />
        </div>
      </section>
    </main>
  );
}

export default BranchAnalyticsCards;