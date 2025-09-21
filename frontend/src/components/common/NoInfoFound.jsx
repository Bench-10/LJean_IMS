import React from 'react'
import { MdInfoOutline } from 'react-icons/md' // INFO ICON

function NoInfoFound({ col }) {
  return (
    <tr className="h-[180px]">
      <td colSpan={col} className="p-0 bg-gray-50">
        <div className="flex flex-col items-center justify-center h-[180px] w-full">
          <MdInfoOutline className="text-4xl text-gray-400 mb-2" />
          <span className="text-center text-lg text-gray-500 italic font-medium">
            No information found
          </span>
        </div>
      </td>
    </tr>
  )
}

export default NoInfoFound