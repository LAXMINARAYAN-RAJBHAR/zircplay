import React from 'react'
import HomePage from '../../Component/HomePage/homePage'
import './home.css'

const Home = ({ sideNavbar }) => {
  return (
    <div className='home'>
      <HomePage sideNavbar={sideNavbar} />
    </div>
  )
}

export default Home