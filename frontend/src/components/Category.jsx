import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../authentication/Authentication';
import { IoMdClose } from 'react-icons/io';
import { FaSpinner } from 'react-icons/fa';

function Category({ isCategoryOpen, onClose, setListCategories, listCategories, fetchProductsData, sanitizeInput}) {

  const {user} = useAuth();

  const [category_name, setCategoryName] = useState('');
  const [editCategory_name, setEditcategoryName] = useState('')
  const [openEdit, setOpenEdit] = useState(false);
  const [selectEditCategory, setSelectEditCategory] = useState({});
  const [addLoading, setAddLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (openEdit)
      setEditcategoryName(selectEditCategory.category_name);
  }, [selectEditCategory, openEdit])

  const generateCategories = async () => {
    try {
      const response = await api.get(`/api/categories/`);
      setListCategories(response.data);
    } catch (error) {
      console.error(error?.message || error);
    }
  };

  useEffect(() => {
    if (!user || user.length === 0) return
    generateCategories();
  }, [user])

  const submitCategory = async (type) => {
    if (type === 'add') {
      const trimmed = (category_name || '').trim();
      setAddError('');
      if (!trimmed) {
        setAddError('Category name cannot be empty');
        return;
      }

      setAddLoading(true);
      try {
        const response = await api.post(`/api/categories/`, { category_name: trimmed });
        setListCategories((prevData) => [...prevData, response.data]);
        console.log('Category Added', response.data);
        setCategoryName('');
      } catch (error) {
        console.error('Error adding Item', error);
        setAddError(error?.response?.data?.message || error?.message || 'Failed to add category');
      } finally {
        setAddLoading(false);
      }

    } else if (type === 'edit') {
      const trimmed = (editCategory_name || '').trim();
      setEditError('');
      if (!trimmed) {
        setEditError('Category name cannot be empty');
        return;
      }

      setEditLoading(true);
      try {
        const category_name = trimmed;
        const response = await api.put(`/api/categories/${selectEditCategory.category_id}`, { category_name });
        setListCategories((prevData) =>
          prevData.map((cat) => (cat.category_id === selectEditCategory.category_id ? response.data : cat))
        );

        console.log('Item Updated', response.data);
        // close edit modal on success
        setOpenEdit(false);
        setSelectEditCategory({});
        setEditcategoryName('');
      } catch (error) {
        console.error('Error updating Item', error);
        setEditError(error?.response?.data?.message || error?.message || 'Failed to update category');
      } finally {
        setEditLoading(false);
      }
    }
  }

  return (
    <div>
      {isCategoryOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
          style={{ pointerEvents: 'auto' }} onClick={onClose}
        />
      )}

      <dialog className='bg-transparent fixed top-10 lg:top-0 bottom-0 z-[9999]' open={isCategoryOpen}>
        <div className="relative flex flex-col border border-gray-600/40 bg-white h-[75vh] lg:h-[600px] w-[95vw] max-w-[600px] rounded-xl p-4 lg:p-6 pb-14 border-gray-300 animate-popup mx-auto my-auto overflow-hidden">
          {/* CLOSE (main) */}
          <button
            type='button'
            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors z-10"
            onClick={() => { onClose(); setOpenEdit(false); }}
            aria-label="Close"
          >
            <IoMdClose className='w-5 h-5 sm:w-6 sm:h-6' />
          </button>

          {/*CATEGORIES TITLE*/}
          <div className='flex text-center mt-2'>
            <h1 className='w-full text-xl sm:text-3xl lg:text-4xl text-left font-bold'>
              CATEGORIES
            </h1>
          </div>

          {/*ADD CATEGORIES */}
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full mt-6 lg:mt-8 gap-3 sm:gap-x-5 '>
            <div className='w-full sm:flex-1'>
              <input
                type="text"
                placeholder='Category Name'
                className='w-full border rounded-lg bg-gray-100 border-gray-300 h-10 px-4'
                value={category_name}
                onChange={(e) => setCategoryName(sanitizeInput(e.target.value))}
              />
              {addError && (
                <p className="text-xs text-red-600 mt-1">{addError}</p>
              )}
            </div>

            <div className='flex'>
              <button
                className={`w-full sm:w-auto border rounded-lg px-4 py-2 text-sm sm:text-base font-medium text-white transition-colors ${category_name.trim() && !addLoading
                    ? 'bg-[#52b7e6] hover:bg-[#0EA5E9]'
                    : 'bg-gray-400 cursor-not-allowed'
                  }`}
                onClick={e => {
                  e.preventDefault();
                  if (category_name.trim() && !addLoading) {
                    submitCategory('add');
                  }
                }}
                disabled={!category_name.trim() || addLoading}
              >
                {addLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <FaSpinner className="animate-spin" /> Adding...
                  </span>
                ) : (
                  'Add Category'
                )}
              </button>
            </div>
          </div>

          {/*CATEGORIES TABLE */}
          <div className='w-full h-full flex-1 mt-4 rounded-lg shadow-sm overflow-x-auto overflow-y-auto hide-scrollbar border border-gray-200'>
            <table className='w-full min-w-[220px] text-left text-base overflow-hidden rounded-lg'>
              <thead className='sticky top-0 h-10'>
                <tr className='bg-gray-200 '>
                  <th className='uppercase text-center text-gray-500 text-xs lg:text-sm font-medium px-2 sm:px-4 w-24 sm:w-[130px]'>Category ID</th>
                  <th className='uppercase text-gray-500 text-xs lg:text-sm font-medium px-4 sm:px-7 '>Category Name</th>
                  <th className='uppercase text-center text-gray-500 text-xs lg:text-sm font-medium px-2 sm:px-4 w-24 sm:w-[130px]'>Action</th>
                </tr>
              </thead>

              <tbody className='divide-gray-100'>
                {listCategories.map((row, rowIndex) => (
                  <tr key={rowIndex} className='h-12 sm:h-14 hover:bg-gray-100 transition-colors'>
                    <td className='text-center text-sm px-2 sm:px-4'>{row.category_id}</td>
                    <td className='px-4 sm:px-7 whitespace-nowrap text-gray-900 font-medium text-sm lg:text-base'>{row.category_name}</td>
                    <td className='text-center text-sm px-2 sm:px-4'>
                      <button
                        className='bg-blue-700 hover:bg-blue-600 px-3 sm:px-5 py-1 border rounded-lg text-white text-xs sm:text-sm'
                        onClick={() => { setOpenEdit(true); setSelectEditCategory(row) }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>

          </div>

          {/*EDIT CATEGORY POPUP */}
          {openEdit && (
            //OVERLAY
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]"
              onClick={() => {
                if (editLoading) return; // prevent closing while editing
                setOpenEdit(false);
                setSelectEditCategory({});
                setEditcategoryName('');
              }}
            >
              <div
                className="relative w-[90vw] max-w-[400px] bg-white rounded-lg p-4 sm:p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {/* CLOSE (edit popup) */}
                <button
                  type="button"
                  className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    if (editLoading) return; // prevent closing while editing
                    setOpenEdit(false);
                    setSelectEditCategory({});
                    setEditcategoryName('');
                  }}
                  aria-label="Close edit dialog"
                >
                  <IoMdClose className='w-5 h-5 sm:w-6 sm:h-6' />
                </button>

                <h3 className="lg:text-xl text-lg font-bold mb-4">Edit Category</h3>
                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    className="border-2 rounded-lg text-sm lg:text-base px-3 py-2 border-gray-300 w-full"
                    value={editCategory_name}
                    onChange={(e) => { setEditcategoryName(sanitizeInput(e.target.value)); if (editError) setEditError(''); }}
                    disabled={editLoading}
                  />
                  {editError && (
                    <p className="text-xs text-red-600 mt-1">{editError}</p>
                  )}
                  <button
                    className={`px-4 py-2 rounded-lg inline-flex items-center gap-2 text-white lg:text-base text-sm ${!editCategory_name.trim() || editLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#007278] hover:bg-[#009097]'}`}
                    onClick={() => { if (!editLoading && editCategory_name.trim()) submitCategory('edit'); }}
                    disabled={editLoading || !editCategory_name.trim()}
                  >
                    {editLoading ? <><FaSpinner className="animate-spin" /> Updating...</> : 'Update Category'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </dialog>
    </div>
  )
}

export default Category;
