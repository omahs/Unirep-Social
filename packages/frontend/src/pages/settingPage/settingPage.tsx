import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import BasicPage from '../basicPage/basicPage'
import PrivateKey from './privateKey'
import MyButton, { ButtonType } from '../../components/myButton'

enum SettingNav {
    PrivateKey,
    Username,
}

const SettingPage = () => {
    const location = useLocation<Location>()
    const state = JSON.parse(JSON.stringify(location.state))
    const isConfirmed = state.isConfirmed

    const [nav, setNav] = useState<SettingNav>(SettingNav.PrivateKey)

    return (
        <BasicPage>
            <h3>Settings</h3>
            <div className="setting-nav-bar">
                <div
                    className={
                        nav === SettingNav.PrivateKey
                            ? 'setting-nav chosen'
                            : 'setting-nav'
                    }
                    onClick={() => setNav(SettingNav.PrivateKey)}
                >
                    Private Key
                </div>
                <div className="interline"></div>
                <div
                    className={
                        nav === SettingNav.Username
                            ? 'setting-nav chosen'
                            : 'setting-nav'
                    }
                    onClick={() => setNav(SettingNav.Username)}
                >
                    User Name
                </div>
            </div>
            {nav === SettingNav.PrivateKey && (
                <div className="setting-content">
                    <img
                        src={require('../../../public/images/reveal-key.svg')}
                    />
                    {/* !UIContext.downloadPrivateKey && <div>It seems like you haven’t download your private key yet, please do so soon.</div> */}
                    <p>
                        It seems like you haven’t download your private key yet,
                        please do so soon.
                    </p>
                    <MyButton type={ButtonType.dark}>
                        Reveal My Private Key
                    </MyButton>
                </div>
            )}
            {nav === SettingNav.Username && (
                <div className="setting-content"></div>
            )}
        </BasicPage>
    )
}

export default SettingPage
