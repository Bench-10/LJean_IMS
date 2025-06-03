
import React from 'react'

function ModalForm({isOpen, onSubmit, mode, onClose}) {
  return (
    <div>
     
        <dialog className="bg-transparent fixed top-0 bottom-0" open={isOpen}>
            <div className=" border border-gray-600 bg-white h-[500px] w-[600px] rounded-md p-7" >
                <h3 className="font-bold text-3xl py-4">
                  {mode === 'edit' ? 'EDIT ITEM' : 'ADD ITEM'}
                </h3>

                {/*FORMS */}
                <form method="dialog">
                
                <button className="btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={onClose}>✕</button>


                </form>

                {/*CONTROL MODAL*/}

                <button className={`${mode === 'edit' ? 'bg-yellow-400' :'bg-green-600'} rounded-lg text-white px-5 py-2`} > 
                  {mode === 'edit' ? 'Save Changes' : 'Add Item'}
                </button>
                
            </div>
        </dialog>
    </div>
  )
}

export default ModalForm