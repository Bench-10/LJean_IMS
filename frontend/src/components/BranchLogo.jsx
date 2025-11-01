import React from 'react';

// Import all logo assets
import ljeanLogo from '../assets/images/ljean.png';
import vinsethLogo from '../assets/images/vinseth.png';
import marajeanLogo from '../assets/images/marajean.png';
import eljeanLogo from '../assets/images/eljean.png';
import camsLogo from '../assets/images/cams.png';
import sethLogo from '../assets/images/seth.png';

// Map branch names to their corresponding logos
const branchLogos = {
  'L-Jean Trading': ljeanLogo,
  'Vinseth Trading': vinsethLogo,
  'MaraJean Trading': marajeanLogo,
  'El Jean Construction Supply': eljeanLogo,
  'Cams Trading': camsLogo,
  'Seth and L-Jean Trading': sethLogo
};




/** BranchLogo component displays the appropriate logo based on the branch name
  @param {Object} props 
  @param {string} [props.branchName]
  @param {string} [props.className='h-12 w-auto'] 
  @returns {JSX.Element} 
 */

const BranchLogo = ({ branchName, className = 'h-12 w-auto' }) => {
  // Get the logo source, default to L-Jean logo if branch not found
  const logoSource = branchLogos[branchName] || ljeanLogo;
  const altText = branchName ? `${branchName} logo` : 'LJean Trading logo';
  
  return (
    <img 
      src={logoSource} 
      alt={altText}
      className={className}
      onError={(e) => {
        e.target.onerror = null; // Prevents infinite loop if the default image also fails
        e.target.src = ljeanLogo;
      }}
    />
  );
};


export { branchLogos };

export default BranchLogo;
