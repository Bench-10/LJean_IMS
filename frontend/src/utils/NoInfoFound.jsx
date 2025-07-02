import React from 'react'

function NoInfoFound({col}) {
  return (
     <tr>
        <td colSpan={col} className="text-center text-lg py-8 text-gray-500 italic">
             No information found
        </td>
    </tr>
  )
}

export default NoInfoFound