import React from 'react';

export const ResponsiveContainer = ({ children, className = '' }) => (
  <div className={`container ${className}`}>
    {children}
  </div>
);

export const ResponsiveGrid = ({ children, className = '', minWidth = '300px' }) => (
  <div 
    className={`responsive-grid ${className}`}
    style={{ 
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`
    }}
  >
    {children}
  </div>
);

export const ResponsiveFlex = ({ children, className = '', direction = 'row', wrap = true }) => (
  <div 
    className={`responsive-flex ${className}`}
    style={{ 
      flexDirection: direction,
      flexWrap: wrap ? 'wrap' : 'nowrap'
    }}
  >
    {children}
  </div>
);

export const ResponsiveCard = ({ children, className = '', onClick }) => (
  <div 
    className={`card-responsive ${className}`}
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default' }}
  >
    {children}
  </div>
);

export const ResponsiveButton = ({ 
  children, 
  onClick, 
  className = '', 
  variant = 'primary',
  size = 'medium',
  disabled = false,
  ...props 
}) => {
  const getVariantClass = () => {
    switch(variant) {
      case 'secondary': return 'bg-gray-500 hover:bg-gray-600';
      case 'success': return 'bg-green-500 hover:bg-green-600';
      case 'danger': return 'bg-red-500 hover:bg-red-600';
      case 'warning': return 'bg-yellow-500 hover:bg-yellow-600';
      default: return '';
    }
  };
  
  const getSizeClass = () => {
    switch(size) {
      case 'small': return 'text-sm p-2';
      case 'large': return 'text-lg p-4';
      default: return '';
    }
  };

  return (
    <button 
      className={`btn-responsive ${getVariantClass()} ${getSizeClass()} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{ 
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export const ResponsiveTable = ({ data, columns, className = '' }) => (
  <div className={`table-responsive ${className}`}>
    <table>
      <thead>
        <tr>
          {columns.map((col, index) => (
            <th key={index} className={col.hideOnMobile ? 'hide-mobile' : ''}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((col, colIndex) => (
              <td key={colIndex} className={col.hideOnMobile ? 'hide-mobile' : ''}>
                {col.accessor ? row[col.accessor] : ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ResponsiveInput = ({ 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  className = '',
  ...props 
}) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={`input-responsive ${className}`}
    {...props}
  />
);